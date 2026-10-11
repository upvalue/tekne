import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('timers')
    .dropConstraint('timers_note_title_fkey')
    .execute()
  await db.schema
    .alterTable('timers')
    .dropConstraint('timers_line_unique')
    .execute()
  await db.schema.dropIndex('timers_single_active').execute()
  for (const column of ['line_id', 'completion_error'])
    await db.schema.alterTable('timers').addColumn(column, 'text').execute()
  for (const column of ['base_time_seconds', 'completed_at'])
    await db.schema
      .alterTable('timers')
      .addColumn(column, 'double precision')
      .execute()
  // Preserve any historical timer only when its timestamp identifies one line.
  await sql`update timers t set line_id = (
    select min(l.line_id) from note_lines l where l.note_title = t.note_title
      and l.time_created = t.line_time_created::timestamp having count(*) = 1
  )`.execute(db)
  await sql`update timers t set base_time_seconds = (l.body->>'datumTimeSeconds')::double precision
    from notes n cross join lateral jsonb_array_elements(n.body->'children') l(body)
    where n.title = t.note_title and l.body->>'id' = t.line_id`.execute(db)
  await db.schema.alterTable('timers').dropColumn('line_time_created').execute()
  await sql`create unique index timers_single_active on timers ((true)) where completed_at is null`.execute(
    db
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  // The previous schema cannot represent completed timers or deleted targets.
  const { rows } = await sql<{
    count: string
  }>`select count(*)::text as count from timers`.execute(db)
  if (rows[0].count !== '0')
    throw new Error('Resolve or discard timers before reverting timer overlays')
  await db.schema.dropIndex('timers_single_active').execute()
  for (const column of [
    'line_id',
    'completion_error',
    'base_time_seconds',
    'completed_at',
  ])
    await db.schema.alterTable('timers').dropColumn(column).execute()
  await db.schema
    .alterTable('timers')
    .addColumn('line_time_created', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .alterTable('timers')
    .addUniqueConstraint('timers_line_unique', [
      'note_title',
      'line_time_created',
    ])
    .execute()
  await db.schema
    .alterTable('timers')
    .addForeignKeyConstraint(
      'timers_note_title_fkey',
      ['note_title'],
      'notes',
      ['title'],
      (c) => c.onUpdate('cascade').onDelete('cascade')
    )
    .execute()
  await sql`create unique index timers_single_active on timers ((true))`.execute(
    db
  )
}
export const tmigration = { up, down }
