import z from 'zod'
import { t } from '../init'
import { sql } from 'kysely'

export const analysisRouter = t.router({
  aggregateData: t.procedure
    .input(
      z.object({
        title: z.string(),
      })
    )
    .query(async ({ input, ctx: { db } }) => {
      const tagsInDoc = await db
        .selectFrom('note_data')
        .select([sql<string>`DISTINCT datum_tag`.as('tag')])
        .where('note_title', '=', input.title)
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
        .where('datum_type', '=', 'timer')
        .where(
          'datum_tag',
          'in',
          tagsInDoc.map((t) => t.tag)
        )
        .groupBy('datum_tag')
        .execute()

      const tasks: {
        [tag: string]: {
          tag: string
          complete_tasks?: number
          incomplete_tasks?: number
          unset_tasks?: number
          total_time_seconds?: number
        }
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

      return Object.values(tasks)
    }),
})
