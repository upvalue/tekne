// @vitest-environment node
import { expect, test } from 'vitest'
import { makeTestDb } from './testing'
import { up } from './migrations/1791770400000_remove-line-colors'
import { docMake, lineMake } from '@/docs/schema'

test('removes only line colors and bumps only affected revisions, once', async () => {
  const { db } = await makeTestDb()
  try {
    const clean = docMake([
      lineMake(0, 'Parent #work', { collapsed: true }),
      lineMake(1, 'Child', {
        datumTimeSeconds: 60,
        datumTaskStatus: 'complete',
      }),
      lineMake(0, 'Uncolored'),
    ])
    const colored = {
      ...clean,
      children: clean.children.map((line, i) =>
        i < 2 ? { ...line, color: i === 0 ? 'blue' : null } : line
      ),
    }
    for (const [title, body] of [
      ['Work', colored],
      ['$Template', colored],
      ['Clean', clean],
      ['Empty', docMake()],
    ] as const) {
      await db
        .insertInto('notes')
        .values({ title, body, revision: 7, parsed_body: [] })
        .execute()
    }
    const before = await db
      .selectFrom('notes')
      .selectAll()
      .orderBy('title')
      .execute()
    await up(db)
    const after = await db
      .selectFrom('notes')
      .selectAll()
      .orderBy('title')
      .execute()
    expect(after).toEqual(
      before.map((note) =>
        ['Work', '$Template'].includes(note.title)
          ? { ...note, body: clean, revision: 8 }
          : note
      )
    )
    await up(db)
    expect(
      await db.selectFrom('notes').selectAll().orderBy('title').execute()
    ).toEqual(after)
  } finally {
    await db.destroy()
  }
}, 60_000)
