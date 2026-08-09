import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { Kysely, PostgresDialect } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import type { Database } from './types'
import { migrateToLatest } from './migrations'

export { type Database } from './types'

declare global {
  interface Window {
    dbHandle: PGlite
    db: Kysely<Database>
    PGlite: typeof PGlite
  }
}

export const DEFAULT_DB_PATH = 'tekne-dev'
export const DB_PATH_KEY = 'tekne/db-path'

export const dbMemory = async () => {
  if (window.db)
    return {
      db: window.db,
      dbHandle: window.dbHandle,
    }

  let dbPath = window.localStorage.getItem(DB_PATH_KEY)
  if (!dbPath) {
    dbPath = DEFAULT_DB_PATH
    window.localStorage.setItem(DB_PATH_KEY, dbPath)
  }

  // Ensure path is in idb:// format for PGlite
  const formattedPath = `idb://${dbPath}`
  console.log('Loading PGlite from', formattedPath)
  // pg_trgm backs the trigram index the search-indexes migration creates
  const handle = new PGlite(formattedPath, { extensions: { pg_trgm } })

  window.dbHandle = handle

  const db = new Kysely<Database>({
    dialect: new PGliteDialect(handle),
  })

  window.db = db
  window.PGlite = PGlite

  await migrateToLatest(db)

  return {
    db,
    dbHandle: handle,
  }
}

export const dbServer = async () => {
  const { Pool } = await import('pg')

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: async () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL!,
        })
        return pool
      },
    }),
  })

  // Keep the server schema in step with the code before any routes can use it.
  // The browser-backed database already does this in dbMemory; without the
  // equivalent here, deploying a migration can leave production queries
  // failing against an older schema.
  await migrateToLatest(db)

  return db
}

export const dbHandle = async () => {
  if (typeof process !== 'undefined') {
    return dbServer()
  }

  return (await dbMemory()).db
}
