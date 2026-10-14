import { sql, type Kysely } from 'kysely'

// Keep migrations independent of the current database types.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TYPE note_data_type_t ADD VALUE 'tag'`.execute(db)
}

export async function down(): Promise<void> {
  throw new Error('Cannot remove enum value - this migration is not reversible')
}

export const tmigration = { up, down }
