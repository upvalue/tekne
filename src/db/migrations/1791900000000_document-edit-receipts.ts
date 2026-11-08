import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('document_patch_receipts')
    .addColumn('kind', 'text', (c) => c.notNull().defaultTo('patch'))
    .addColumn('result', 'jsonb')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Edit receipts cannot be interpreted by the older patch-only application.
  await db
    .deleteFrom('document_patch_receipts')
    .where('kind', '=', 'edit')
    .execute()
  await db.schema
    .alterTable('document_patch_receipts')
    .dropColumn('kind')
    .dropColumn('result')
    .execute()
}

export const tmigration = { up, down }
