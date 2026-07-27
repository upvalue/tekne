// analysis.ts - currently aggregate data related stuff
import { uniqBy } from 'lodash-es'
import z from 'zod'
import { t } from '../init'
import {
  aggregateTagData,
  hasAggregateData,
  type TagAggregateData,
} from '../lib/tag-aggregates'

export const analysisRouter = t.router({
  /**
   * Aggregate summary of every tag in a document: the totals across all
   * documents, plus what this one page contributes.
   */
  aggregateData: t.procedure
    .input(
      z.object({
        title: z.string(),
      })
    )
    .query(async ({ input, ctx: { db } }): Promise<TagAggregateData[]> => {
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
        // Already narrowed to one document, and that document may itself be a
        // template. Pins are a global notion, so there is no page-scoped one
        // to look up.
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
    }),
})
