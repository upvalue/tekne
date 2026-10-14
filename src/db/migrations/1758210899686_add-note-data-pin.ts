import { sql, type Kysely } from 'kysely'

// Keep migrations independent of the current database types.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TYPE note_data_type_t ADD VALUE 'pin'`.execute(db)
  await db.schema
    .alterTable('note_data')
    .addColumn('datum_pinned_at', 'timestamp')
    .addColumn('datum_pinned_content', 'text')
    .execute()
}

export async function down(): Promise<void> {
  // Note: PostgreSQL doesn't support removing enum values directly
  // This would require recreating the type and updating all dependent objects
  throw new Error('Cannot remove enum value - this migration is not reversible')
}

export const tmigration = { up, down }
