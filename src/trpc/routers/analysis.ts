// analysis.ts - currently aggregate data related stuff
import { uniqBy } from 'lodash-es'
import z from 'zod'
import { t } from '../init'
import { sql } from 'kysely'

type TagAggregateData = {
  tag: string
  complete_tasks?: number
  incomplete_tasks?: number
  unset_tasks?: number
  total_time_seconds?: number
  pinned_at?: Date
  pinned_desc?: string | null
}

export const analysisRouter = t.router({
  /**
   * This function does a few different queries to
   * create the aggregate summary of a tag over time
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
        // .select([sql<string>`DISTINCT datum_tag`.as('tag')])
        .where('datum_type', '=', 'tag')
        .where('note_title', '=', input.title)
        .orderBy('time_created', 'asc')
        .execute()

      const tagsInDoc = uniqBy(allTagsInDoc, 'tag')

      if (tagsInDoc.length === 0) {
        return []
      }

      const taskPins = await db
        .selectFrom('note_data')
        .select(['datum_tag as tag', 'datum_pinned_at', 'datum_pinned_content'])
        .where('note_title', '=', input.title)
        .where('datum_type', '=', 'pin')
        .where(
          'datum_tag',
          'in',
          tagsInDoc.map((t) => t.tag)
        )
        .orderBy('datum_pinned_at', 'desc')
        .execute()

      const taskData = await db
        .selectFrom('note_data')
        .select([
          'datum_tag as tag',
          sql<number>`COUNT(CASE WHEN datum_status = 'complete' THEN 1 END)`.as(
            'complete_tasks'
          ),
          sql<number>`COUNT(CASE WHEN datum_status = 'incomplete' THEN 1 END)`.as(
            'incomplete_tasks'
          ),
          sql<number>`COUNT(CASE WHEN datum_status = 'unset' OR datum_status IS NULL THEN 1 END)`.as(
            'unset_tasks'
          ),
          sql<number>`COUNT(*)`.as('total_tasks'),
        ])
        // Exclude templates from aggregate view
        .where('note_title', 'not ilike', '$%')
        .where('datum_type', '=', 'task')
        .where(
          'datum_tag',
          'in',
          tagsInDoc.map((t) => t.tag)
        )
        .groupBy('datum_tag')
        .execute()

      const timerData = await db
        .selectFrom('note_data')
        .select([
          'datum_tag as tag',
          sql<number>`SUM(datum_time_seconds)`.as('total_time_seconds'),
        ])
        // Exclude templates from aggregate view
        .where('note_title', 'not ilike', '$%')
        .where('datum_type', '=', 'timer')
        .where(
          'datum_tag',
          'in',
          tagsInDoc.map((t) => t.tag)
        )
        .groupBy('datum_tag')
        .execute()

      const tasks: {
        [tag: string]: TagAggregateData
      } = {}

      for (const task of taskData) {
        if (!tasks[task.tag]) {
          tasks[task.tag] = { tag: task.tag }
        }
        tasks[task.tag] = {
          tag: task.tag,
          complete_tasks: task.complete_tasks,
          incomplete_tasks: task.incomplete_tasks,
          unset_tasks: task.unset_tasks,
        }
      }

      for (const timer of timerData) {
        if (!tasks[timer.tag]) {
          tasks[timer.tag] = { tag: timer.tag }
        }
        tasks[timer.tag].total_time_seconds = timer.total_time_seconds
      }

      // Find most recent pin
      // Should be done in SQL
      for (const pin of taskPins) {
        if (!tasks[pin.tag]) {
          tasks[pin.tag] = { tag: pin.tag }
        }

        if (
          (tasks[pin.tag].pinned_at &&
            tasks[pin.tag].pinned_at! < pin.datum_pinned_at!) ||
          !tasks[pin.tag].pinned_at
        ) {
          tasks[pin.tag].pinned_at = pin.datum_pinned_at!
          tasks[pin.tag].pinned_desc = pin.datum_pinned_content
        }
      }

      // Return tasks ordered by their appearance in tagsInDoc
      return tagsInDoc
        .map((tagInDoc) => tasks[tagInDoc.tag])
        .filter((task): task is TagAggregateData => task !== undefined)
    }),
})
