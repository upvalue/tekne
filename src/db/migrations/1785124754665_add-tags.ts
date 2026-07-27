import { sql, type Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // Tag metadata. Tag existence is derived from note_data; rows here exist
  // only for tags with metadata (currently just a description). tag_name is
  // stored without the leading '#'.
  await db.schema
    .createTable('tags')
    .addColumn('tag_name', 'text', (col) => col.primaryKey())
    .addColumn('description', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute()

  await db.schema
    .createIndex('note_data_datum_tag_idx')
    .on('note_data')
    .columns(['datum_type', 'datum_tag'])
    .execute()
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('note_data_datum_tag_idx').execute()
  await db.schema.dropTable('tags').execute()
}

export const tmigration = { up, down }
