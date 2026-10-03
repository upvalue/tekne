import { Migrator } from 'kysely'
import type { Kysely, Migration } from 'kysely'

import { tmigration as initMigration } from './migrations/1752986809444_init'
import { tmigration as addDocDatesMigration } from './migrations/1756085936353_add-doc-dates.ts'
import { tmigration as addDocRevisionMigration } from './migrations/1756431034379_add-doc-revision.ts'
import { tmigration as addNoteDataMigration } from './migrations/1757182212830_add-note-data.ts'
import { tmigration as alterNoteDataTypeEnumMigration } from './migrations/1758154595036_alter-note-data-type-enum.ts'
import { tmigration as addNoteDataPinMigration } from './migrations/1758210899686_add-note-data-pin.ts'
import { tmigration as addNoteParsedBodyMigration } from './migrations/1758235135865_add-note-parsed-body.ts'
import { tmigration as noteUpdateCascadeMigration } from './migrations/1758243487015_note-update-cascade.ts'
import { tmigration as addSavedSearchesMigration } from './migrations/1769300006926_add-saved-searches.ts'
import { tmigration as addNoteLinesMigration } from './migrations/1769317427281_add-note-lines.ts'
import { tmigration as addFeatureFlagsMigration } from './migrations/1771632000000_add-feature-flags.ts'
import { tmigration as addTagsMigration } from './migrations/1785124754665_add-tags.ts'
import { tmigration as addTagArchivedMigration } from './migrations/1785217524142_add-tag-archived.ts'
import { tmigration as searchIndexesMigration } from './migrations/1785908646900_search-indexes.ts'
import type { Database } from './types'

/**
 * Every migration, keyed by its filename (sans extension) in
 * src/db/migrations. A test asserts the keys match the directory listing, so
 * a typo'd key can't silently skip or re-run a migration.
 */
export const MIGRATIONS: Record<string, Migration> = {
  '1752986809444_init': initMigration,
  '1756085936353_add-doc-dates': addDocDatesMigration,
  '1756431034379_add-doc-revision': addDocRevisionMigration,
  '1757182212830_add-note-data': addNoteDataMigration,
  '1758154595036_alter-note-data-type-enum': alterNoteDataTypeEnumMigration,
  '1758210899686_add-note-data-pin': addNoteDataPinMigration,
  '1758235135865_add-note-parsed-body': addNoteParsedBodyMigration,
  '1758243487015_note-update-cascade': noteUpdateCascadeMigration,
  '1769300006926_add-saved-searches': addSavedSearchesMigration,
  '1769317427281_add-note-lines': addNoteLinesMigration,
  '1771632000000_add-feature-flags': addFeatureFlagsMigration,
  '1785124754665_add-tags': addTagsMigration,
  '1785217524142_add-tag-archived': addTagArchivedMigration,
  '1785908646900_search-indexes': searchIndexesMigration,
}

/**
 * Provider for Tekne that hardcodes migrations
 *
 * This is workaround for using pglite -- it's not quite as nice
 * as using the FileMigrationProvider and probable that can be
 * re-implemented with some Vite/frontend awareness
 */
const runMigration = async (
  db: Kysely<Database>,
  direction: 'migrateToLatest' | 'migrateDown'
) => {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => MIGRATIONS },
  })
  const { error, results } = await migrator[direction]()
  const reverting = direction === 'migrateDown'

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(
        `[db] Migration "${it.migrationName}" was ${reverting ? 'reverted' : 'executed'} successfully`
      )
    } else if (it.status === 'Error') {
      console.error(
        `[db] Failed to ${reverting ? 'revert' : 'execute'} migration "${it.migrationName}"`
      )
    }
  })

  if (error) {
    console.error('[db] Failed to migrate')
    console.error(error)
    process.exit(1)
  }
}

export const migrateToLatest = (db: Kysely<Database>) =>
  runMigration(db, 'migrateToLatest')

export const migrateDown = (db: Kysely<Database>) =>
  runMigration(db, 'migrateDown')
