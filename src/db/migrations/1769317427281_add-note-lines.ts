import type { Kysely } from 'kysely'

// Keep migrations independent of the current database types.
export async function up(db: Kysely<any>): Promise<void> {
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

  await db.schema
    .createIndex('note_lines_content_idx')
    .on('note_lines')
    .column('content')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('note_lines').execute()
}

export const tmigration = { up, down }
