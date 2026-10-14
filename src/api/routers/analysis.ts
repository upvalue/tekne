import { ORPCError } from '@orpc/server'
import { outputs } from '../outputs'
import { uniqBy } from 'lodash-es'
import z from 'zod'
import { proc } from '../init'
import {
  aggregateTagData,
  latestTagPins,
  hasAggregateData,
  type TagAggregateData,
} from '../lib/tag-aggregates'

export const analysisRouter = {
  aggregateSnapshot: proc
    .route({
      method: 'GET',
      path: '/analysis/document/snapshot',
      tags: ['analysis'],
      summary: 'Aggregate baseline for local edits',
      description:
        'Read global totals, the included page contributions, document revision and external pins from one database snapshot. Explicit tags include tags introduced by unsaved local edits.',
    })
    .input(z.object({ title: z.string(), tags: z.array(z.string()) }))
    .output(outputs.analysis.aggregateSnapshot)
    .handler(async ({ input, context: { db } }) => {
      // Counts, page contributions and revision must describe the same snapshot.
      return db
        .transaction()
        .setIsolationLevel('repeatable read')
        .execute(async (tx) => {
          const note = await tx
            .selectFrom('notes')
            .select('revision')
            .where('title', '=', input.title)
            .executeTakeFirst()
          if (!note)
            throw new ORPCError('NOT_FOUND', {
              message: 'Document no longer exists',
            })
          const tags = [...new Set(input.tags)]
          const [overall, page, otherPins] = await Promise.all([
            aggregateTagData(tx, tags, { excludeTemplates: true }),
            aggregateTagData(
              tx,
              tags,
              { docTitle: input.title, excludeTemplates: false },
              { withPins: false }
            ),
            latestTagPins(tx, tags, {
              excludeDocTitle: input.title,
              excludeTemplates: true,
            }),
          ])
          const pins = new Map(otherPins.map((pin) => [pin.tag, pin]))
          return {
            title: input.title,
            revision: note.revision,
            rows: tags.map((tag) => ({
              ...overall.get(tag)!,
              page_complete_tasks: page.get(tag)!.complete_tasks,
              page_incomplete_tasks: page.get(tag)!.incomplete_tasks,
              page_unset_tasks: page.get(tag)!.unset_tasks,
              page_time_seconds: page.get(tag)!.total_time_seconds,
              other_pinned_at: pins.get(tag)?.pinned_at ?? null,
              other_pinned_desc: pins.get(tag)?.pinned_desc ?? null,
              other_pin_line_id: pins.get(tag)?.pin_line_id ?? null,
            })),
          }
        })
    }),

  /**
   * Aggregate summary of every tag in a document: the totals across all
   * documents, plus what this one page contributes.
   */
  aggregateData: proc
    .route({
      method: 'GET',
      path: '/analysis/document',
      tags: ['analysis'],
      summary: 'Aggregate data',
      description:
        'Get tag totals across documents and contributions from the named title.',
    })
    .output(outputs.analysis.aggregateData)
    .input(
      z.object({
        title: z.string(),
      })
    )
    .handler(
      async ({ input, context: { db } }): Promise<TagAggregateData[]> => {
        const allTagsInDoc = await db
          .selectFrom('note_data')
          .select(['datum_tag as tag'])
          .where('datum_type', '=', 'tag')
          .where('note_title', '=', input.title)
          .orderBy('time_created', 'asc')
          .execute()

        const tagsInDoc = uniqBy(allTagsInDoc, 'tag').map((t) => t.tag)

        if (tagsInDoc.length === 0) {
          return []
        }

        const [overall, onThisPage] = await Promise.all([
          aggregateTagData(db, tagsInDoc, { excludeTemplates: true }),
          // Include templates when viewing their own totals; pins are global only.
          aggregateTagData(
            db,
            tagsInDoc,
            { docTitle: input.title, excludeTemplates: false },
            { withPins: false }
          ),
        ])

        return (
          tagsInDoc
            .map((tag) => {
              const page = onThisPage.get(tag)
              return {
                ...overall.get(tag)!,
                page_complete_tasks: page?.complete_tasks,
                page_incomplete_tasks: page?.incomplete_tasks,
                page_unset_tasks: page?.unset_tasks,
                page_time_seconds: page?.total_time_seconds,
              }
            })
            // A tag that is only ever written bare has nothing to show, and the
            // panel says as much rather than rendering an empty card.
            .filter(hasAggregateData)
            .sort((a, b) => a.tag.localeCompare(b.tag))
        )
      }
    ),
}
