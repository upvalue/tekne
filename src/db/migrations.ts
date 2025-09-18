import { Migrator } from 'kysely'
import type { Kysely, Migration, MigrationProvider } from 'kysely'

import { tmigration as initMigration } from './migrations/1752986809444_init'
import { tmigration as addDocDatesMigration } from './migrations/1756085936353_add-doc-dates.ts'
import { tmigration as addDocRevisionMigration } from './migrations/1756431034379_add-doc-revision.ts'
import { tmigration as addNoteDataMigration } from './migrations/1757182212830_add-note-data.ts'
import { tmigration as alterNoteDataTypeEnumMigration } from './migrations/1758154595036_alter-note-data-type-enum.ts'
import type { Database } from './types'

/**
 * Provider for Tekne that hardcodes migrations
 *
 * This is workaround for using pglite -- it's not quite as nice
 * as using the FileMigrationProvider and probable that can be
 * re-implemented with some Vite/frontend awareness
 */
class TekneMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Migration> = {}

    migrations['1752986809444_init'] = initMigration
    migrations['1756085936353_add-doc-dates'] = addDocDatesMigration
    migrations['1756431034379_add-doc-revision'] = addDocRevisionMigration
    migrations['1757182212830_add-note-data'] = addNoteDataMigration
    migrations['1758154595036_alter-note-data-type-enum'] = alterNoteDataTypeEnumMigration
    return migrations
  }
}

const getMigrator = (db: Kysely<Database>) =>
  new Migrator({
    db,
    provider: new TekneMigrationProvider(),
  })

// Export utilities for running migrations
export async function migrateToLatest(db: Kysely<Database>) {
  const migrator = getMigrator(db)

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(
        `[db] Migration "${it.migrationName}" was executed successfully`
      )
    } else if (it.status === 'Error') {
      console.error(`[db] Failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('[db] Failed to migrate')
    console.error(error)
    process.exit(1)
  }
}

export async function migrateDown(db: Kysely<Database>) {
  const migrator = getMigrator(db)

  const { error, results } = await migrator.migrateDown()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(
        `[db] Migration "${it.migrationName}" was reverted successfully`
      )
    } else if (it.status === 'Error') {
      console.error(`[db] Failed to revert migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('[db] Failed to migrate')
    console.error(error)
    process.exit(1)
  }
}
