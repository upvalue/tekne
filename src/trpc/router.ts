import z from 'zod'
import { sql } from 'kysely'
import { router, proc } from './init'
import { docRouter } from './routers/doc'
import { analysisRouter } from './routers/analysis'
import { searchRouter } from './routers/search'
import { flagsRouter } from './routers/flags'

import fs from 'fs'
import child_process from 'child_process'

export const appRouter = router({
  doc: docRouter,
  analysis: analysisRouter,
  search: searchRouter,
  flags: flagsRouter,

  healthcheck: proc.query(async ({ ctx: { db } }) => {
    const q = await db
      .selectFrom(sql`(select 1)`.as('subquery'))
      .selectAll()
      .execute()

    return q
  }),

  ping: proc.query(() => {
    return 'pong2'
  }),

  execHook: proc
    .input(
      z.object({
        hook: z.enum(['timer-start', 'timer-stop']),
        argument: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('execHook', input)
      const { hook, argument } = input

      // If running on server
      if (typeof process !== 'undefined') {
        if (hook === 'timer-start' || hook === 'timer-stop') {
          const { line, lineIdx, doc } = argument

          if (fs.existsSync(`hooks/${hook}`)) {
            child_process.execSync(`hooks/${hook}`, {
              input: JSON.stringify({
                type: 'timer-event',
                line,
                lineIdx,
                doc,
              }),
            })
          }
        }
      } else {
        console.log('[hook] client execHook', hook, argument)
      }
    }),
})

export type AppRouter = typeof appRouter
