import { sql, type Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
  // Text search runs ILIKE '%…%' and ~* over note_lines.content, which a
  // plain btree can never serve; a trigram GIN index can. pg_trgm is a
  // trusted extension on Postgres and is bundled for PGlite in src/db.
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db)
  await db.schema.dropIndex('note_lines_content_idx').ifExists().execute()
  await sql`CREATE INDEX note_lines_content_trgm_idx ON note_lines USING gin (content gin_trgm_ops)`.execute(
    db
  )

  // The datum-filter EXISTS subquery in search correlates note_data on
  // (note_title, line_idx), which had no supporting index.
  await db.schema
    .createIndex('note_data_note_line_idx')
    .on('note_data')
    .columns(['note_title', 'line_idx'])
    .execute()
}

// `any` is required here since migrations should be frozen in time.
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('note_data_note_line_idx').execute()
  await db.schema.dropIndex('note_lines_content_trgm_idx').execute()
  await db.schema
    .createIndex('note_lines_content_idx')
    .on('note_lines')
    .column('content')
    .execute()
}

export const tmigration = { up, down }
