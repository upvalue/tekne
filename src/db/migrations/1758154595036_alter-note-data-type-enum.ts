import { sql, type Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TYPE note_data_type_t ADD VALUE 'tag'`.execute(db)
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(): Promise<void> {
  throw new Error('Cannot remove enum value - this migration is not reversible')
}

export const tmigration = { up, down }
