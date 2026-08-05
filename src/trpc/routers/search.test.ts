// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '@/db/types'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake, type ZLine } from '@/docs/schema'
import { t } from '../init'
import { upsertNoteInTx } from './doc'
import { searchRouter } from './search'

let db: Kysely<Database>
let caller: ReturnType<typeof createCaller>

const createCaller = t.createCallerFactory(searchRouter)

const noteWith = (title: string, lines: Array<string | Partial<ZLine>>) =>
  upsertNoteInTx(
    db,
    title,
    docMake(
      lines.map((ln) =>
        typeof ln === 'string' ? lineMake(0, ln) : lineMake(0, '', ln)
      )
    )
  )

const contentsOf = (result: { items: Array<{ content: string }> }) =>
  result.items.map((i) => i.content)

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

describe('searchLines', () => {
  test('text operator matches content, case-insensitively', async () => {
    await noteWith('Doc', ['Alpha work', 'beta work', 'gamma'])

    const result = await caller.searchLines({
      operators: [{ type: 'text', value: 'WORK', wildcard: 'none' }],
    })

    expect(contentsOf(result).sort()).toEqual(['Alpha work', 'beta work'])
  })

  test('literal % and _ in text search do not act as wildcards', async () => {
    await noteWith('Doc', ['progress 100% done', 'progress 100x done'])

    const result = await caller.searchLines({
      operators: [{ type: 'text', value: '100%', wildcard: 'none' }],
    })

    expect(contentsOf(result)).toEqual(['progress 100% done'])
  })

  test('doc glob matches * and ? but treats _ literally', async () => {
    await noteWith('log_a', ['underscore doc'])
    await noteWith('logxa', ['x doc'])

    const underscore = await caller.searchLines({
      operators: [{ type: 'doc', value: 'log_a' }],
    })
    expect(contentsOf(underscore)).toEqual(['underscore doc'])

    const glob = await caller.searchLines({
      operators: [{ type: 'doc', value: 'log?a' }],
    })
    expect(contentsOf(glob).sort()).toEqual(['underscore doc', 'x doc'])
  })

  test('tag and status operators filter through note_data', async () => {
    await noteWith('Doc', [
      { mdContent: '#proj done thing', datumTaskStatus: 'complete' },
      { mdContent: '#proj open thing', datumTaskStatus: 'incomplete' },
      { mdContent: '#other open thing', datumTaskStatus: 'incomplete' },
    ])

    const result = await caller.searchLines({
      operators: [
        { type: 'tag', value: '#proj' },
        { type: 'status', value: 'incomplete' },
      ],
    })

    expect(contentsOf(result)).toEqual(['#proj open thing'])
    expect(result.items[0]).toMatchObject({
      tags: ['#proj'],
      datum_task_status: 'incomplete',
    })
  })

  test('templates are excluded', async () => {
    await noteWith('$Daily', ['template line'])
    await noteWith('Real', ['real line'])

    const result = await caller.searchLines({ operators: [] })
    expect(contentsOf(result)).toEqual(['real line'])
  })

  test('child_count counts the indented block under a line', async () => {
    await upsertNoteInTx(
      db,
      'Doc',
      docMake([
        lineMake(0, 'parent findme'),
        lineMake(1, 'child one'),
        lineMake(2, 'grandchild'),
        lineMake(0, 'sibling'),
      ])
    )

    const result = await caller.searchLines({
      operators: [{ type: 'text', value: 'findme', wildcard: 'none' }],
    })

    expect(result.items[0].child_count).toBe(2)
  })

  test('pagination over identical timestamps neither repeats nor drops lines', async () => {
    const ts = '2025-06-01T12:00:00.000Z'
    await noteWith(
      'Doc',
      Array.from({ length: 10 }, (_, i) => ({
        mdContent: `line ${i}`,
        timeCreated: ts,
        timeUpdated: ts,
      }))
    )

    const seen: string[] = []
    let cursor: number | undefined
    do {
      const page = await caller.searchLines({
        operators: [],
        limit: 3,
        cursor,
      })
      seen.push(...contentsOf(page))
      cursor = page.nextCursor
    } while (cursor !== undefined)

    expect(seen.sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `line ${i}`).sort()
    )
    expect(new Set(seen).size).toBe(10)
  })
})

describe('searchAggregate', () => {
  test('aggregates the tags matching the query', async () => {
    await noteWith('Doc', [
      { mdContent: '#proj timed', datumTimeSeconds: 60 },
      { mdContent: '#proj done', datumTaskStatus: 'complete' },
      { mdContent: '#other line', datumTaskStatus: 'incomplete' },
    ])

    const result = await caller.searchAggregate({
      operators: [{ type: 'tag', value: '#proj' }],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ tag: '#proj' })
  })

  test('line-level operators are rejected instead of silently ignored', async () => {
    await noteWith('Doc', [
      { mdContent: '#proj open', datumTaskStatus: 'incomplete' },
    ])

    await expect(
      caller.searchAggregate({
        operators: [
          { type: 'tag', value: '#proj' },
          { type: 'status', value: 'incomplete' },
        ],
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('saved searches', () => {
  test('save, list, delete round-trip', async () => {
    const saved = await caller.saveSearch({ name: 'Mine', query: 'tag:#proj' })
    expect(saved).toMatchObject({ name: 'Mine', query: 'tag:#proj' })

    expect(await caller.getSavedSearches()).toHaveLength(1)

    await caller.deleteSavedSearch({ id: saved.id })
    expect(await caller.getSavedSearches()).toHaveLength(0)
  })
})
