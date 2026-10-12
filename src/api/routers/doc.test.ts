// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '@/db/types'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake, type ZDoc } from '@/docs/schema'
import { createRouterClient } from '@orpc/server'
import { docRouter, upsertNoteInTx } from './doc'

let db: Kysely<Database>
let caller: ReturnType<typeof createCaller>

const createCaller = (context: { db: Kysely<Database> }) =>
  createRouterClient(docRouter, { context })

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
  test('concurrent creation has one winner and preserves its first revision', async () => {
    const results = await Promise.allSettled([
      caller.createDoc({ name: 'Race' }),
      caller.createDoc({ name: 'Race' }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { code: 'CONFLICT' },
    })
    expect((await caller.loadDoc({ name: 'Race' })).revision).toBe(0)
  })
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
      message: 'Document "Nope" not found',
    })
    await expect(caller.loadDocDetails({ name: 'Nope' })).rejects.toMatchObject(
      { code: 'NOT_FOUND', message: 'Document "Nope" not found' }
    )
  })
})

describe('createDocFromTemplate', () => {
  test('concurrent copies cannot replace the winning document', async () => {
    await noteWith('$Example', ['template content'])
    const results = await Promise.allSettled([
      caller.createDocFromTemplate({ name: 'Copy', templateName: '$Example' }),
      caller.createDocFromTemplate({ name: 'Copy', templateName: '$Example' }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.find((result) => result.status === 'rejected')
    ).toMatchObject({ reason: { code: 'CONFLICT' } })
    expect((await caller.loadDoc({ name: 'Copy' })).revision).toBe(0)
    expect(await lineContents('Copy')).toEqual(['template content'])
  })
  test('missing templates keep their distinct NOT_FOUND message', async () => {
    await expect(
      caller.createDocFromTemplate({ name: 'New', templateName: '$Missing' })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Template "$Missing" not found',
    })
  })

  test.each([{ contents: [] }, { contents: ['template #tag'] }])(
    'creates content from $contents',
    async ({ contents }) => {
      await noteWith('$Template', contents)
      await caller.createDocFromTemplate({
        name: 'New',
        templateName: '$Template',
      })
      expect(await lineContents('New')).toEqual(
        contents.length ? contents : ['']
      )
      expect((await caller.loadDoc({ name: 'New' })).revision).toBe(0)
    }
  )
})

describe('updateDoc', () => {
  test.each([-1, 0.5])(
    'rejects invalid indentation %s before writing any data',
    async (indent) => {
      await noteWith('Valid', ['original'])
      const { doc, revision } = await caller.loadDoc({ name: 'Valid' })
      doc.children[0].indent = indent
      await expect(
        caller.updateDoc({ name: 'Valid', doc, expectedRevision: revision })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      expect(await lineContents('Valid')).toEqual(['original'])
      expect((await caller.loadDoc({ name: 'Valid' })).revision).toBe(revision)
    }
  )
  test('bumps the revision and rebuilds derived rows', async () => {
    await noteWith('Doc', ['first'])

    const result = await caller.updateDoc({
      name: 'Doc',
      doc: docMake([lineMake(0, 'first'), lineMake(1, 'second #tagged')]),
    })

    expect(result).toMatchObject({ status: 'ok', revision: 1 })
    expect(await lineContents('Doc')).toEqual(['first', 'second #tagged'])
    const data = await db
      .selectFrom('note_data')
      .select(['datum_tag'])
      .where('note_title', '=', 'Doc')
      .execute()
    expect(data).toEqual([{ datum_tag: '#tagged' }])
  })

  test('a stale expectedRevision returns the stored document instead of writing', async () => {
    await noteWith('Doc', ['v0'])
    await caller.updateDoc({ name: 'Doc', doc: docMake([lineMake(0, 'v1')]) })

    const result = await caller.updateDoc({
      name: 'Doc',
      doc: docMake([lineMake(0, 'stale write')]),
      expectedRevision: 0,
    })

    expect(result.status).toBe('conflict')
    if (result.status !== 'conflict') throw new Error('unreachable')
    expect(result.serverRevision).toBe(1)
    expect(result.serverDoc.children[0].mdContent).toBe('v1')

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
    const result = await caller.updateDoc({
      name: 'New',
      doc: docMake([lineMake(0, 'hello')]),
    })
    expect(result).toMatchObject({ status: 'ok', revision: 0 })
    expect(await lineContents('New')).toEqual(['hello'])
  })
})

describe('renameDocExecute', () => {
  test.each(['Target', '2026-10-12', 'Project: Alpha'])(
    'rewrites inbound links to %s, including multiple links on one line',
    async (target) => {
      await noteWith(target, ['content'])
      await noteWith('Referrer', [
        `see [[${target}]] and [[${target}]] again`,
        'unrelated [[Other]]',
      ])

      const result = await caller.renameDocExecute({
        oldName: target,
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
      await expect(caller.loadDoc({ name: target })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    }
  )

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

describe('line identity writes', () => {
  test('rejects stale clients and duplicate IDs without changing the document', async () => {
    const doc = docMake([lineMake(0, 'keep')])
    await upsertNoteInTx(db, 'Work', doc)
    for (const invalid of [
      { ...doc, schemaVersion: 1 },
      { ...doc, children: [doc.children[0], doc.children[0]] },
    ]) {
      await expect(
        caller.updateDoc({ name: 'Work', doc: invalid, expectedRevision: 0 })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    expect((await caller.loadDoc({ name: 'Work' })).doc).toEqual(doc)
  })

  test('rejects reuse across documents and leaves both documents intact', async () => {
    const first = docMake([lineMake(0, 'first')])
    const second = docMake([lineMake(0, 'second')])
    await upsertNoteInTx(db, 'First', first)
    await upsertNoteInTx(db, 'Second', second)
    await expect(
      caller.updateDoc({ name: 'Second', doc: first, expectedRevision: 0 })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await caller.loadDoc({ name: 'First' })).doc).toEqual(first)
    expect((await caller.loadDoc({ name: 'Second' })).doc).toEqual(second)
  })

  test('template instances get independent IDs without changing the template', async () => {
    const template = docMake([lineMake(0, 'parent'), lineMake(1, 'child')])
    await upsertNoteInTx(db, '$Template', template)
    await caller.createDocFromTemplate({
      name: 'First',
      templateName: '$Template',
    })
    await caller.createDocFromTemplate({
      name: 'Second',
      templateName: '$Template',
    })
    const first = (await caller.loadDoc({ name: 'First' })).doc
    const second = (await caller.loadDoc({ name: 'Second' })).doc
    expect(
      new Set(
        [...template.children, ...first.children, ...second.children].map(
          (line) => line.id
        )
      ).size
    ).toBe(6)
    expect((await caller.loadDoc({ name: '$Template' })).doc).toEqual(template)
  })
})

test('saving legacy input cannot restore line colors', async () => {
  const { db } = await makeTestDb()
  try {
    const line = lineMake(0, 'Legacy line')
    await upsertNoteInTx(
      db,
      'Work',
      docMake([{ ...line, ...{ color: 'blue' } }])
    )
    const saved = await db
      .selectFrom('notes')
      .select('body')
      .where('title', '=', 'Work')
      .executeTakeFirstOrThrow()
    expect(saved.body).toEqual(docMake([line]))
  } finally {
    await db.destroy()
  }
}, 60_000)

describe('patchDoc', () => {
  test('patches preserve full-save derived data and duplicate requests acknowledge once', async () => {
    const { diffDocuments } = await import('@/docs/document-patch')
    const before = docMake([
      lineMake(0, '#work'),
      lineMake(1, 'task', { datumTaskStatus: 'unset' }),
    ])
    await upsertNoteInTx(db, 'Patch', before)
    const after = structuredClone(before)
    after.children[1].datumTaskStatus = 'complete'
    after.children[0].mdContent = '#new'
    after.children.unshift(lineMake(0, 'inserted'))
    const input = {
      name: 'Patch',
      expectedRevision: 0,
      requestId: crypto.randomUUID(),
      patch: diffDocuments(before, after),
    }
    expect(await caller.patchDoc(input)).toEqual({ status: 'ok', revision: 1 })
    const rows = await db
      .selectFrom('note_data')
      .selectAll()
      .where('note_title', '=', 'Patch')
      .execute()
    const lines = await lineContents('Patch')
    expect(await caller.patchDoc(input)).toEqual({ status: 'ok', revision: 1 })
    expect(await caller.loadDoc({ name: 'Patch' })).toEqual({
      doc: after,
      revision: 1,
    })
    await caller.updateDoc({ name: 'Patch', doc: after, expectedRevision: 1 })
    expect(
      await db
        .selectFrom('note_data')
        .selectAll()
        .where('note_title', '=', 'Patch')
        .execute()
    ).toEqual(rows)
    expect(await lineContents('Patch')).toEqual(lines)
    // A late retry still acknowledges its own revision after another writer saves.
    expect(await caller.patchDoc(input)).toEqual({ status: 'ok', revision: 1 })
    expect((await caller.loadDoc({ name: 'Patch' })).revision).toBe(2)
    await expect(
      caller.patchDoc({ ...input, patch: [] })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('stale revisions, invalid operations and deleted documents never partially write', async () => {
    const before = docMake([lineMake(0, 'original #tag')])
    await upsertNoteInTx(db, 'Patch', before)
    const request = {
      name: 'Patch',
      expectedRevision: 0,
      requestId: crypto.randomUUID(),
    }
    await expect(
      caller.patchDoc({
        ...request,
        patch: [
          {
            op: 'update',
            line: { ...before.children[0], mdContent: 'changed' },
          },
          { op: 'delete', id: lineMake(0).id },
        ],
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await caller.loadDoc({ name: 'Patch' })).toEqual({
      doc: before,
      revision: 0,
    })
    expect(await lineContents('Patch')).toEqual(['original #tag'])
    expect(
      await db.selectFrom('document_patch_receipts').selectAll().execute()
    ).toEqual([])
    expect(
      await caller.patchDoc({ ...request, expectedRevision: 7, patch: [] })
    ).toEqual({ status: 'conflict', serverDoc: before, serverRevision: 0 })
    await caller.deleteDoc({ name: 'Patch' })
    await expect(
      caller.patchDoc({ ...request, patch: [] })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('competing patches accept only one revision and reject cross-document line IDs', async () => {
    const before = docMake([lineMake(0, 'original')])
    await upsertNoteInTx(db, 'Patch', before)
    const results = await Promise.all(
      ['one', 'two'].map((mdContent) =>
        caller.patchDoc({
          name: 'Patch',
          expectedRevision: 0,
          requestId: crypto.randomUUID(),
          patch: [{ op: 'update', line: { ...before.children[0], mdContent } }],
        })
      )
    )
    expect(results.map((result) => result.status).sort()).toEqual([
      'conflict',
      'ok',
    ])
    const other = lineMake(0, 'belongs elsewhere')
    await upsertNoteInTx(db, 'Other', docMake([other]))
    await expect(
      caller.patchDoc({
        name: 'Patch',
        expectedRevision: 1,
        requestId: crypto.randomUUID(),
        patch: [{ op: 'insert', line: other, after: null }],
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await caller.loadDoc({ name: 'Patch' })).revision).toBe(1)
  })
})
