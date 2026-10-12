import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('document_patch_receipts')
    .addColumn('request_id', 'text', (c) => c.primaryKey())
    .addColumn('note_title', 'text', (c) =>
      c
        .notNull()
        .references('notes.title')
        .onUpdate('cascade')
        .onDelete('cascade')
    )
    .addColumn('request_hash', 'text', (c) => c.notNull())
    .addColumn('revision', 'integer', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('document_patch_receipts_note')
    .on('document_patch_receipts')
    .column('note_title')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('document_patch_receipts').execute()
}

export const tmigration = { up, down }
