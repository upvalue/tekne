// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import type { Database } from '@/db/types'
import { migrateToLatest } from '@/db/migrations'
import { docMake, lineMake } from '@/docs/schema'
import { t } from '../init'
import { upsertNoteInTx } from './doc'
import { tagsRouter } from './tags'

let pg: PGlite
let db: Kysely<Database>
let caller: ReturnType<typeof createCaller>

const createCaller = t.createCallerFactory(tagsRouter)

/** Writes a note with one line per tag, so note_data is derived as in the app. */
const noteWithTags = (title: string, tags: string[]) =>
  upsertNoteInTx(
    db,
    title,
    docMake(tags.map((tag, idx) => lineMake(0, `${tag} line ${idx}`)))
  )

beforeAll(async () => {
  pg = new PGlite()
  db = new Kysely<Database>({ dialect: new PGliteDialect(pg) })
  await migrateToLatest(db)
  caller = createCaller({ db })
}, 60_000)

afterAll(async () => {
  await db.destroy()
})

beforeEach(async () => {
  await db.deleteFrom('note_data').execute()
  await db.deleteFrom('notes').execute()
  await db.deleteFrom('tags').execute()
})

describe('archiving', () => {
  test('archived tags drop out of autocomplete but keep their occurrences', async () => {
    await noteWithTags('Doc', ['#old', '#new'])

    await caller.setArchived({ name: 'old', archived: true })

    expect(await caller.allTags()).toEqual(['new'])
    expect(await caller.list()).toMatchObject([
      { name: 'new', archived: false, lineCount: 1, docCount: 1 },
      { name: 'old', archived: true, lineCount: 1, docCount: 1 },
    ])
  })

  test('restoring is reversible and leaves no metadata row behind', async () => {
    await noteWithTags('Doc', ['#old'])

    await caller.setArchived({ name: 'old', archived: true })
    await caller.setArchived({ name: 'old', archived: false })

    expect(await caller.allTags()).toEqual(['old'])
    expect(await db.selectFrom('tags').selectAll().execute()).toEqual([])
  })

  test('archiving preserves a description, and clearing one preserves the archive', async () => {
    await noteWithTags('Doc', ['#old'])

    await caller.setDescription({ name: 'old', description: 'retired' })
    await caller.setArchived({ name: 'old', archived: true })
    expect(await caller.list()).toMatchObject([
      { name: 'old', description: 'retired', archived: true },
    ])

    await caller.setDescription({ name: 'old', description: '' })
    expect(await caller.list()).toMatchObject([
      { name: 'old', description: null, archived: true },
    ])
  })

  test('a tag can be archived before it is ever used', async () => {
    await caller.setArchived({ name: 'planned', archived: true })

    expect(await caller.allTags()).toEqual([])
    expect(await caller.list()).toMatchObject([
      { name: 'planned', archived: true, lineCount: 0, docCount: 0 },
    ])
  })
})

describe('rename carries archived state', () => {
  test('a pure rename stays archived', async () => {
    await noteWithTags('Doc', ['#old'])
    await caller.setArchived({ name: 'old', archived: true })

    await caller.renameExecute({
      oldName: 'old',
      newName: 'fresh',
      includeChildren: false,
    })

    expect(await caller.list()).toMatchObject([
      { name: 'fresh', archived: true },
    ])
  })

  test('merging into a tag still in use does not retire it', async () => {
    await noteWithTags('Doc', ['#old', '#live'])
    await caller.setArchived({ name: 'old', archived: true })

    await caller.renameExecute({
      oldName: 'old',
      newName: 'live',
      includeChildren: false,
    })

    expect(await caller.list()).toMatchObject([
      { name: 'live', archived: false },
    ])
  })
})
