// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '@/db/types'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake, type ZLine } from '@/docs/schema'
import { createRouterClient } from '@orpc/server'
import { upsertNoteInTx } from './doc'
import { searchRouter } from './search'

let db: Kysely<Database>
let caller: ReturnType<typeof createCaller>

const createCaller = (context: { db: Kysely<Database> }) =>
  createRouterClient(searchRouter, { context })

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

describe('query reports', () => {
  test('pagination preserves totals and quoted document/text filters', async () => {
    await noteWith(
      'My log',
      Array.from({ length: 5 }, (_, i) => ({
        mdContent: `100% run ${i}`,
        datumTimeSeconds: 60,
        timeCreated: '2026-10-18T12:00:00Z',
        timeUpdated: '2026-10-19T12:00:00Z',
      }))
    )
    await noteWith('Other', ['100x run'])
    const query =
      'doc:"My log" "100% run" from:2026-10-18 to:2026-10-18 updated:2026-10-19'
    const ids: string[] = []
    let cursor = 0
    while (true) {
      const page = await caller.query({ query, cursor, limit: 2 })
      expect(page.summary.timeSeconds).toBe(300)
      ids.push(...page.items.map((item) => item.lineId))
      if (page.nextCursor === null) break
      cursor = page.nextCursor
    }
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })

  test('counts unique lines, includes untagged time, and reports overlapping inherited groups', async () => {
    await noteWith('2026-10-18', [
      { mdContent: '#exercise #health' },
      {
        mdContent: 'Run',
        indent: 1,
        datumTimeSeconds: 2700,
        datumTaskStatus: 'complete',
      },
      { mdContent: 'Stretch', indent: 1, datumTimeSeconds: 900 },
      { mdContent: 'Untagged', datumTimeSeconds: 1800 },
    ])
    await noteWith('$Daily', [
      { mdContent: 'Template', datumTimeSeconds: 9999 },
    ])
    const result = await caller.query({
      query: 'doc:2026-10-18 has:timer',
      groupBy: 'tag',
      limit: 1,
    })
    expect(result.summary).toEqual({
      matchedCount: 3,
      timedEntryCount: 3,
      timeSeconds: 5400,
    })
    expect(result.items).toHaveLength(1)
    expect(result.nextCursor).toBe(1)
    expect(result.groupsOverlap).toBe(true)
    expect(result.groups).toEqual([
      { key: '#exercise', matchedCount: 2, timeSeconds: 3600 },
      { key: '#health', matchedCount: 2, timeSeconds: 3600 },
      { key: null, matchedCount: 1, timeSeconds: 1800 },
    ])
    const filtered = await caller.query({
      query: '#exercise #health status:complete has:timer Run',
    })
    expect(filtered.summary.timeSeconds).toBe(2700)
    expect(filtered.items[0]).toMatchObject({
      content: 'Run',
      tags: ['#exercise', '#health'],
      lineId: expect.any(String),
    })
    const all = await caller.query({ query: '', summaryOnly: true })
    expect(all.items).toEqual([])
    expect(all.summary.timeSeconds).toBe(5400)
    expect(all.nextCursor).toBeNull()
  })

  test('calendar date boundaries respect timezone and DST', async () => {
    await noteWith('Log', [
      { mdContent: 'before', timeCreated: '2026-03-08T07:59:59Z' },
      {
        mdContent: 'start',
        timeCreated: '2026-03-08T08:00:00Z',
        datumTimeSeconds: 0,
      },
      {
        mdContent: 'end',
        timeCreated: '2026-03-09T06:59:59Z',
        datumTimeSeconds: 1.5,
      },
      { mdContent: 'after', timeCreated: '2026-03-09T07:00:00Z' },
    ])
    const result = await caller.query({
      query: 'created:2026-03-08 has:timer',
      timezone: 'America/Los_Angeles',
      groupBy: 'document',
    })
    expect(contentsOf(result).sort()).toEqual(['end', 'start'])
    expect(result.summary).toEqual({
      matchedCount: 2,
      timedEntryCount: 2,
      timeSeconds: 1.5,
    })
    expect(result.groups).toEqual([
      { key: 'Log', matchedCount: 2, timeSeconds: 1.5 },
    ])
  })

  test('empty reports and validation errors are explicit', async () => {
    expect((await caller.query({ query: '#missing' })).summary).toEqual({
      matchedCount: 0,
      timedEntryCount: 0,
      timeSeconds: 0,
    })
    for (const input of [
      { query: 'oops:today' },
      { query: 'created:2026-02-30' },
      { query: '', timezone: 'Mars/Olympus' },
    ]) {
      await expect(caller.query(input)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
    }
  })
})
