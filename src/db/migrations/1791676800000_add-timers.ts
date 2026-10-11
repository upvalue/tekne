import { sql, type Kysely } from 'kysely'

// Already applied in production. Keep the historical migration even though
// timer persistence is deferred and the application does not use this table.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('timers')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('note_title', 'text', (c) =>
      c
        .references('notes.title')
        .onUpdate('cascade')
        .onDelete('cascade')
        .notNull()
    )
    .addColumn('line_time_created', 'text', (c) => c.notNull())
    .addColumn('line_content', 'text', (c) => c.notNull())
    .addColumn('mode', 'text', (c) => c.notNull())
    .addColumn('time_mode', 'text', (c) => c.notNull())
    .addColumn('accumulated_ms', 'double precision', (c) => c.notNull())
    .addColumn('running_since', 'double precision')
    .addColumn('target_duration', 'integer', (c) => c.notNull())
    .addColumn('revision', 'integer', (c) => c.notNull())
    .addUniqueConstraint('timers_line_unique', [
      'note_title',
      'line_time_created',
    ])
    .execute()
  await sql`create unique index timers_single_active on timers ((true))`.execute(
    db
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('timers').execute()
}

export const tmigration = { up, down }
