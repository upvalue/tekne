// @vitest-environment node
import { expect, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { Kysely, Migrator, sql } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import { MIGRATIONS } from './migrations'
import { prepareLineIdMigration } from './migrations/1791763200000_line-ids'
import { zdoc } from '@/docs/schema'

const setup = async () => {
  const db = new Kysely<any>({
    dialect: new PGliteDialect(new PGlite({ extensions: { pg_trgm } })),
  })
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => MIGRATIONS },
  })
  const result = await migrator.migrateTo('1785908646900_search-indexes')
  if (result.error) throw result.error
  return { db, migrator }
}
const legacy = () => ({
  type: 'doc',
  schemaVersion: 1,
  children: Array.from({ length: 3 }, () => ({
    type: 'line',
    mdContent: 'same text #work',
    indent: 0,
    timeCreated: '2024-01-01T00:00:00.000Z',
    timeUpdated: '2024-02-01T00:00:00.000Z',
    datumTimeSeconds: 30,
  })),
})

test('full migration preserves data, assigns unique IDs, populates derived rows, and is stable on rerun', async () => {
  const { db, migrator } = await setup()
  try {
    const original = legacy()
    for (const title of ['Work', '$Template'])
      await db
        .insertInto('notes')
        .values({ title, body: original, revision: 7, parsed_body: [] })
        .execute()
    await db
      .insertInto('note_data')
      .values({
        note_title: 'Work',
        line_idx: 1,
        datum_tag: '#work',
        datum_type: 'timer',
        datum_time_seconds: 30,
        time_created: new Date('2024-01-01'),
        time_updated: new Date('2024-02-01'),
      })
      .execute()
    const before = await db
      .selectFrom('notes')
      .selectAll()
      .orderBy('title')
      .execute()
    expect(await prepareLineIdMigration(db)).toHaveLength(2)
    expect(
      await db.selectFrom('notes').selectAll().orderBy('title').execute()
    ).toEqual(before)
    const result = await migrator.migrateToLatest()
    expect(result.error).toBeUndefined()
    const after = await db
      .selectFrom('notes')
      .selectAll()
      .orderBy('title')
      .execute()
    const ids = new Set<string>()
    for (const [index, note] of after.entries()) {
      const doc = zdoc.parse(note.body)
      expect(note.revision).toBe(8)
      expect(note.updatedAt).toEqual(before[index].updatedAt)
      expect(
        doc.children.map(({ id, ...line }) => {
          ids.add(id)
          return line
        })
      ).toEqual(original.children)
    }
    expect(ids.size).toBe(6)
    expect(
      await db.selectFrom('note_lines').selectAll().execute()
    ).toHaveLength(6)
    const datum = await db
      .selectFrom('note_data')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(datum.line_id).toBe(
      after.find((n) => n.title === 'Work')!.body.children[1].id
    )
    expect(datum.datum_time_seconds).toBe(30)
    expect(
      (await prepareLineIdMigration(db)).every((note) => !note.changed)
    ).toBe(true)
    expect((await migrator.migrateToLatest()).error).toBeUndefined()
    expect(
      await db.selectFrom('notes').selectAll().orderBy('title').execute()
    ).toEqual(after)
    await expect(
      sql`insert into note_lines (note_title, line_idx, line_id, content, indent) values ('Work', 99, ${datum.line_id}, '', 0)`.execute(
        db
      )
    ).rejects.toThrow()
  } finally {
    await db.destroy()
  }
}, 60000)

test('invalid legacy data aborts the transaction without partially assigning IDs', async () => {
  const { db, migrator } = await setup()
  try {
    await db
      .insertInto('notes')
      .values({
        title: 'Bad',
        body: {
          ...legacy(),
          children: [{ ...legacy().children[0], indent: 'bad' }],
        },
        revision: 0,
        parsed_body: [],
      })
      .execute()
    const result = await migrator.migrateToLatest()
    expect(result.error).toBeDefined()
    const note = await db
      .selectFrom('notes')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(note.body.schemaVersion).toBe(1)
    expect(note.revision).toBe(0)
    expect(note.body.children[0].id).toBeUndefined()
  } finally {
    await db.destroy()
  }
}, 60000)
