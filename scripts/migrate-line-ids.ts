import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { prepareLineIdMigration } from '../src/db/migrations/1791763200000_line-ids'
import { migrateToLatest, MIGRATIONS } from '../src/db/migrations'
import type { Database } from '../src/db/types'

const envFile = process.argv
  .find((arg) => arg.startsWith('--env-file='))
  ?.slice(11)
if (envFile) dotenv.config({ path: envFile, quiet: true })
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
})
try {
  const history = await sql<{
    name: string
  }>`select name from kysely_migration`.execute(db)
  for (const { name } of history.rows) {
    if (!(name in MIGRATIONS))
      throw new Error(`Missing historical migration: ${name}`)
  }
  const notes = await prepareLineIdMigration(db)
  console.log(
    JSON.stringify({
      documents: notes.length,
      lines: notes.reduce((n, note) => n + note.body.children.length, 0),
      documentsToMigrate: notes.filter((note) => note.changed).length,
    })
  )
  if (process.argv.includes('--execute')) await migrateToLatest(db)
  if (process.argv.includes('--verify') || process.argv.includes('--execute')) {
    const result = await sql<{
      mismatches: string
    }>`select count(*)::text as mismatches from notes n
      cross join lateral jsonb_array_elements(n.body->'children') with ordinality as l(body, ordinality)
      left join note_lines r on r.note_title = n.title and r.line_idx = l.ordinality - 1
      where r.line_id is distinct from l.body->>'id'`.execute(db)
    const data = await sql<{
      mismatches: string
    }>`select count(*)::text as mismatches from note_data d left join note_lines l
      on d.note_title = l.note_title and d.line_idx = l.line_idx where d.line_id is distinct from l.line_id`.execute(
      db
    )
    if (result.rows[0].mismatches !== '0' || data.rows[0].mismatches !== '0')
      throw new Error('Derived line IDs do not match document IDs')
    if ((await prepareLineIdMigration(db)).some((note) => note.changed))
      throw new Error('Unmigrated documents remain')
    console.log('Line IDs and derived rows verified')
  }
} finally {
  await db.destroy()
}
