import type { Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time
export async function up(db: Kysely<any>): Promise<void> {
  // Create note_lines table to store every line's content for text search
  await db.schema
    .createTable('note_lines')
    .addColumn('note_title', 'text', (col) => col.notNull())
    .addColumn('line_idx', 'integer', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('indent', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('time_created', 'timestamp')
    .addColumn('time_updated', 'timestamp')
    .addPrimaryKeyConstraint('note_lines_pk', ['note_title', 'line_idx'])
    .addForeignKeyConstraint(
      'note_lines_note_fk',
      ['note_title'],
      'notes',
      ['title'],
      (cb) => cb.onDelete('cascade').onUpdate('cascade')
    )
    .execute()

  // Create index on content for faster text search
  await db.schema
    .createIndex('note_lines_content_idx')
    .on('note_lines')
    .column('content')
    .execute()
}

// `any` is required here since migrations should be frozen in time
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('note_lines').execute()
}

export const tmigration = { up, down }
