import type { Kysely } from 'kysely'

// Keep migrations independent of the current database types.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('notes')
    .addColumn('revision', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('notes').dropColumn('revision').execute()
}

export const tmigration = { up, down }
