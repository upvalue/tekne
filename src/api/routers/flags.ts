import { outputs } from '../outputs'
import { z } from 'zod'
import { proc } from '../init'

export const flagsRouter = {
  getAll: proc
    .route({
      method: 'GET',
      path: '/flags',
      tags: ['flags'],
      summary: 'Get all',
      description: 'Read all feature flags.',
    })
    .output(outputs.flags.getAll)
    .input(z.object({}).optional())
    .handler(async ({ context: { db } }) => {
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

  set: proc
    .route({
      method: 'PUT',
      path: '/flags',
      tags: ['flags'],
      summary: 'Set',
      description: 'Set a feature flag key to any JSON value.',
    })
    .output(outputs.flags.set)
    .input(
      z.object({
        key: z.string(),
        value: z.unknown(),
      })
    )
    .handler(async ({ input, context: { db } }) => {
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
}
