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

      const data = await db
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

      return data
    }),
})