import type { Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // Archiving is metadata only: documents keep their occurrences of an
  // archived tag, it just stops being offered for new use.
  await db.schema
    .alterTable('tags')
    .addColumn('archived_at', 'timestamp')
    .execute()
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('tags').dropColumn('archived_at').execute()
}

export const tmigration = { up, down }
