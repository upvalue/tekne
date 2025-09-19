import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notes')
    .addColumn('title', 'text', (col) => col.primaryKey().notNull())
    .addColumn('body', 'jsonb', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notes').execute()
}

export const tmigration = { up, down }
