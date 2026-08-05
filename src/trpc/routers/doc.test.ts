// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '@/db/types'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake, type ZDoc } from '@/docs/schema'
import { t } from '../init'
import { docRouter, upsertNoteInTx } from './doc'

let db: Kysely<Database>
let caller: ReturnType<typeof createCaller>

const createCaller = t.createCallerFactory(docRouter)

const noteWith = (title: string, contents: string[]) =>
  upsertNoteInTx(db, title, docMake(contents.map((c) => lineMake(0, c))))

const lineContents = (title: string) =>
  db
    .selectFrom('note_lines')
    .select(['content'])
    .where('note_title', '=', title)
    .orderBy('line_idx')
    .execute()
    .then((rows) => rows.map((r) => r.content))

beforeAll(async () => {
  ;({ db } = await makeTestDb())
  caller = createCaller({ db })
}, 60_000)

afterAll(async () => {
  await db.destroy()
})

beforeEach(async () => {
  await db.deleteFrom('note_data').execute()
  await db.deleteFrom('note_lines').execute()
  await db.deleteFrom('notes').execute()
})

describe('createDoc', () => {
  test('creates a document with derived line rows', async () => {
    await caller.createDoc({ name: 'Fresh' })

    const { doc, revision } = await caller.loadDoc({ name: 'Fresh' })
    expect(doc.children).toHaveLength(1)
    expect(revision).toBe(0)
    expect(await lineContents('Fresh')).toEqual([''])
  })

  test('rejects a duplicate name with CONFLICT', async () => {
    await caller.createDoc({ name: 'Dup' })
    await expect(caller.createDoc({ name: 'Dup' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })
})

describe('loadDoc / loadDocDetails', () => {
  test('missing documents surface NOT_FOUND', async () => {
    await expect(caller.loadDoc({ name: 'Nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(caller.loadDocDetails({ name: 'Nope' })).rejects.toMatchObject(
      { code: 'NOT_FOUND' }
    )
  })
})

describe('updateDoc', () => {
  test('bumps the revision and rebuilds derived rows', async () => {
    await noteWith('Doc', ['first'])

    const { revision } = await caller.updateDoc({
      name: 'Doc',
      doc: docMake([lineMake(0, 'first'), lineMake(1, 'second #tagged')]),
    })

    expect(revision).toBe(1)
    expect(await lineContents('Doc')).toEqual(['first', 'second #tagged'])
    const data = await db
      .selectFrom('note_data')
      .select(['datum_tag'])
      .where('note_title', '=', 'Doc')
      .execute()
    expect(data).toEqual([{ datum_tag: '#tagged' }])
  })

  test('rejects a stale expectedRevision with CONFLICT', async () => {
    await noteWith('Doc', ['v0'])
    await caller.updateDoc({ name: 'Doc', doc: docMake([lineMake(0, 'v1')]) })

    await expect(
      caller.updateDoc({
        name: 'Doc',
        doc: docMake([lineMake(0, 'stale write')]),
        expectedRevision: 0,
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    const { doc } = await caller.loadDoc({ name: 'Doc' })
    expect(doc.children[0].mdContent).toBe('v1')
  })

  test('a conditional write against a deleted document is NOT_FOUND, not a resurrection', async () => {
    await noteWith('Doc', ['v0'])
    await caller.deleteDoc({ name: 'Doc' })

    await expect(
      caller.updateDoc({
        name: 'Doc',
        doc: docMake([lineMake(0, 'ghost')]),
        expectedRevision: 0,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    await expect(caller.loadDoc({ name: 'Doc' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  test('an unconditional write may create the document', async () => {
    const { revision } = await caller.updateDoc({
      name: 'New',
      doc: docMake([lineMake(0, 'hello')]),
    })
    expect(revision).toBe(0)
    expect(await lineContents('New')).toEqual(['hello'])
  })
})

describe('renameDocExecute', () => {
  test('rewrites inbound links, including multiple links on one line', async () => {
    await noteWith('Target', ['content'])
    await noteWith('Referrer', [
      'see [[Target]] and [[Target]] again',
      'unrelated [[Other]]',
    ])

    const result = await caller.renameDocExecute({
      oldName: 'Target',
      newName: 'Renamed',
    })

    expect(result).toMatchObject({ newName: 'Renamed', linksUpdated: 2 })

    const { doc } = await caller.loadDoc({ name: 'Referrer' })
    expect(doc.children[0].mdContent).toBe(
      'see [[Renamed]] and [[Renamed]] again'
    )
    expect(doc.children[1].mdContent).toBe('unrelated [[Other]]')

    // Derived rows must reflect the rewritten body
    expect(await lineContents('Referrer')).toEqual([
      'see [[Renamed]] and [[Renamed]] again',
      'unrelated [[Other]]',
    ])

    // The document itself is renamed; the old name is gone
    await expect(caller.loadDoc({ name: 'Renamed' })).resolves.toBeTruthy()
    await expect(caller.loadDoc({ name: 'Target' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  test('renaming onto an existing document is CONFLICT and changes nothing', async () => {
    await noteWith('A', ['[[B]]'])
    await noteWith('B', ['content'])

    await expect(
      caller.renameDocExecute({ oldName: 'B', newName: 'A' })
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    const { doc } = await caller.loadDoc({ name: 'A' })
    expect(doc.children[0].mdContent).toBe('[[B]]')
  })
})

describe('deleteDoc', () => {
  test('deletes the document and its derived rows', async () => {
    await noteWith('Doomed', ['#tag line'])

    await caller.deleteDoc({ name: 'Doomed' })

    await expect(caller.loadDoc({ name: 'Doomed' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(await lineContents('Doomed')).toEqual([])
    const data = await db
      .selectFrom('note_data')
      .selectAll()
      .where('note_title', '=', 'Doomed')
      .execute()
    expect(data).toEqual([])
  })

  test('missing documents surface NOT_FOUND', async () => {
    await expect(caller.deleteDoc({ name: 'Nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('migrateAllDocs', () => {
  test('migrated bodies get their derived rows rebuilt and revision bumped', async () => {
    // A legacy document written before the datumTime -> datumTimeSeconds
    // rename, inserted raw so no derived rows exist yet.
    const legacyBody = {
      type: 'doc',
      children: [
        {
          type: 'line',
          mdContent: 'timed work #proj',
          indent: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          datumTime: 90,
        },
      ],
    } as unknown as ZDoc
    await db
      .insertInto('notes')
      .values({
        title: 'Legacy',
        body: legacyBody,
        revision: 0,
        parsed_body: [],
      })
      .execute()

    const { summary } = await caller.migrateAllDocs()
    expect(summary).toMatchObject({ totalDocs: 1, migratedDocs: 1 })

    const { doc, revision } = await caller.loadDoc({ name: 'Legacy' })
    expect(doc.children[0].datumTimeSeconds).toBe(90)
    expect(doc.children[0].timeCreated).toBe('2024-01-01T00:00:00.000Z')
    expect(revision).toBe(1)

    // Derived data reflects the migrated body without a separate recompute
    expect(await lineContents('Legacy')).toEqual(['timed work #proj'])
    const data = await db
      .selectFrom('note_data')
      .select(['datum_type', 'datum_time_seconds', 'datum_tag'])
      .where('note_title', '=', 'Legacy')
      .orderBy('datum_type')
      .execute()
    expect(data).toContainEqual(
      expect.objectContaining({ datum_type: 'timer', datum_time_seconds: 90 })
    )
    expect(data).toContainEqual(
      expect.objectContaining({ datum_type: 'tag', datum_tag: '#proj' })
    )
  })

  test('documents already at the current schema are untouched', async () => {
    await noteWith('Modern', ['fine as is'])

    const { summary } = await caller.migrateAllDocs()
    expect(summary).toMatchObject({ migratedDocs: 0, unchangedDocs: 1 })

    const { revision } = await caller.loadDoc({ name: 'Modern' })
    expect(revision).toBe(0)
  })
})
