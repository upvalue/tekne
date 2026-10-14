import type { Kysely } from 'kysely'

// Keep migrations independent of the current database types.
export async function up(db: Kysely<any>): Promise<void> {
  // Archiving is metadata only: documents keep their occurrences of an
  // archived tag, it just stops being offered for new use.
  await db.schema
    .alterTable('tags')
    .addColumn('archived_at', 'timestamp')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('tags').dropColumn('archived_at').execute()
}

export const tmigration = { up, down }
