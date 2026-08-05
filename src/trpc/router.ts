import z from 'zod'
import { zdoc } from '@/docs/schema'
import { router, proc } from './init'
import { docRouter } from './routers/doc'
import { analysisRouter } from './routers/analysis'
import { searchRouter } from './routers/search'
import { flagsRouter } from './routers/flags'
import { tagsRouter } from './routers/tags'

import fs from 'fs'
import child_process from 'child_process'
import path from 'path'

export const appRouter = router({
  doc: docRouter,
  analysis: analysisRouter,
  search: searchRouter,
  flags: flagsRouter,
  tags: tagsRouter,

  ping: proc.query(() => {
    return 'pong2'
  }),

  execHook: proc
    .input(
      z.object({
        hook: z.enum(['timer-start', 'timer-stop']),
        argument: z.object({
          doc: zdoc,
          line: z.string(),
          lineIdx: z.number().int().nonnegative(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const { hook, argument } = input

      // If running on server
      if (typeof process !== 'undefined') {
        if (hook === 'timer-start' || hook === 'timer-stop') {
          const { line, lineIdx, doc } = argument

          const hookPath = path.resolve('hooks', hook)

          if (fs.existsSync(hookPath)) {
            const child = child_process.spawn(hookPath, [], {
              stdio: ['pipe', 'ignore', 'pipe'],
            })

            const timeout = setTimeout(() => {
              child.kill('SIGKILL')
            }, 5_000)

            child.on('close', () => {
              clearTimeout(timeout)
            })

            child.stderr.on('data', (chunk) => {
              console.error('[hook] execHook stderr', hook, chunk.toString())
            })

            child.on('error', (error) => {
              console.error('[hook] execHook failed', hook, error)
            })

            child.stdin.write(
              JSON.stringify({
                type: 'timer-event',
                line,
                lineIdx,
                doc,
              })
            )
            child.stdin.end()
          }
        }
      } else {
        console.log('[hook] client execHook', hook, argument)
      }
    }),
})

export type AppRouter = typeof appRouter
