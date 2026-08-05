import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import type { Database } from './types'
import { migrateToLatest } from './migrations'

/**
 * An in-memory, fully migrated database for tests. Carries the same PGlite
 * extensions as the dev database so migrations behave identically.
 */
export const makeTestDb = async (): Promise<{
  pg: PGlite
  db: Kysely<Database>
}> => {
  const pg = new PGlite({ extensions: { pg_trgm } })
  const db = new Kysely<Database>({ dialect: new PGliteDialect(pg) })
  await migrateToLatest(db)
  return { pg, db }
}
