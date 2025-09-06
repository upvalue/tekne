import { initTRPC } from '@trpc/server'
import type { Database } from '@/db'
import type { Kysely } from 'kysely'

export const t = initTRPC.context<{ db: Kysely<Database> }>().create({
  allowOutsideOfServer: true,
})

export const router = t.router
export const proc = t.procedure