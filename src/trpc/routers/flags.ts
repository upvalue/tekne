import { z } from 'zod'
import { sql } from 'kysely'
import { t } from '../init'

export const flagsRouter = t.router({
  getAll: t.procedure.query(async ({ ctx: { db } }) => {
    const rows = await db
      .selectFrom('feature_flags')
      .select(['key', 'value'])
      .execute()

    const flags: Record<string, unknown> = {}
    for (const row of rows) {
      flags[row.key] = row.value
    }
    return flags
  }),

  set: t.procedure
    .input(
      z.object({
        key: z.string(),
        value: z.unknown(),
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      await db
        .insertInto('feature_flags')
        .values({
          key: input.key,
          value: JSON.stringify(input.value),
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc.column('key').doUpdateSet({
            value: JSON.stringify(input.value),
            updated_at: new Date(),
          })
        )
        .execute()

      return { success: true }
    }),
})
