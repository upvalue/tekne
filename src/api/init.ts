import { os } from '@orpc/server'
import type { Database } from '@/db'
import type { Kysely } from 'kysely'

export const proc = os
  .$context<{ db: Kysely<Database> }>()
  .errors({ BAD_REQUEST: {}, NOT_FOUND: {}, CONFLICT: {} })

// Stored documents may predate the current schema. Reading them must preserve
// legacy fields so the editor and maintenance tools can migrate them.
export const storedDocumentProc = proc.$config({
  initialOutputValidationIndex: Number.NaN,
})
