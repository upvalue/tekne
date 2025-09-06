import { sql, type Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  db.schema
    .createType('note_data_status_t')
    .asEnum(['complete', 'incomplete', 'unset'])
    .execute()
  db.schema
    .createTable('note_data')
    .addColumn('note_title', 'text', (col) =>
      col.references('notes.title').onDelete('cascade').notNull()
    )
    .addColumn('line_idx', 'integer', (col) => col.notNull())
    .addColumn('time_created', 'timestamp', (col) => col.notNull())
    .addColumn('time_updated', 'timestamp', (col) => col.notNull())
    .addColumn('datum_tag', 'text', (col) => col.notNull())
    .addColumn('datum_status', sql`note_data_status_t`)
    .addColumn('datum_time_seconds', 'bigint')
    .execute()
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations

  db.schema.dropType('note_data_status_t')
  db.schema.dropTable('note_data')
}

export const tmigration = { up, down }
