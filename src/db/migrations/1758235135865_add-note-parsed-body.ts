import type { Kysely } from 'kysely'

// Keep migrations independent of the current database types.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('notes')
    .addColumn('parsed_body', 'jsonb')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('notes').dropColumn('parsed_body').execute()
}

export const tmigration = { up, down }
