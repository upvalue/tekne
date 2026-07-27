// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import type { Database } from '@/db/types'
import { migrateToLatest } from '@/db/migrations'
import { docMake } from '@/docs/schema'
import { aggregateTagData, hasAggregateData } from './tag-aggregates'

let pg: PGlite
let db: Kysely<Database>

/** Inserts a note_data row, defaulting the columns a given test doesn't care about. */
const datum = (row: {
  note_title: string
  datum_tag: string
  datum_type: 'task' | 'timer' | 'pin' | 'tag'
  line_idx?: number
  datum_status?: 'complete' | 'incomplete' | 'unset'
  datum_time_seconds?: number
  datum_pinned_at?: Date | null
  datum_pinned_content?: string | null
  time_created?: Date
}) =>
  db
    .insertInto('note_data')
    .values({
      line_idx: 0,
      time_created: new Date('2026-01-01'),
      time_updated: new Date('2026-01-01'),
      ...row,
    })
    .execute()

const note = (title: string) =>
  db
    .insertInto('notes')
    .values({
      title,
      body: docMake([]),
      parsed_body: [],
      revision: 0,
    })
    .execute()

beforeAll(async () => {
  pg = new PGlite()
  db = new Kysely<Database>({ dialect: new PGliteDialect(pg) })
  await migrateToLatest(db)
}, 60_000)

afterAll(async () => {
  await db.destroy()
})

beforeEach(async () => {
  await db.deleteFrom('note_data').execute()
  await db.deleteFrom('notes').execute()
})

describe('aggregateTagData', () => {
  test('returns a zero-filled entry for every tag asked about', async () => {
    const results = await aggregateTagData(db, ['#a', '#b'], {
      excludeTemplates: true,
    })

    expect([...results.keys()]).toEqual(['#a', '#b'])
    expect(results.get('#a')).toEqual({
      tag: '#a',
      complete_tasks: 0,
      incomplete_tasks: 0,
      unset_tasks: 0,
      total_time_seconds: 0,
      pinned_at: null,
      pinned_desc: null,
    })
  })

  test('counts tasks by status and sums timers', async () => {
    await note('Doc')
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'task',
      datum_status: 'complete',
    })
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'task',
      datum_status: 'incomplete',
    })
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'task',
      datum_status: 'unset',
    })
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 90,
    })
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 30,
    })

    const results = await aggregateTagData(db, ['#work'], {
      excludeTemplates: true,
    })

    expect(results.get('#work')).toMatchObject({
      complete_tasks: 1,
      incomplete_tasks: 1,
      unset_tasks: 1,
      total_time_seconds: 120,
    })
  })

  test('takes the most recent pin', async () => {
    await note('Doc')
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'pin',
      datum_pinned_at: new Date('2026-01-01'),
      datum_pinned_content: 'older',
    })
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'pin',
      datum_pinned_at: new Date('2026-06-01'),
      datum_pinned_content: 'newer',
    })

    const results = await aggregateTagData(db, ['#work'], {
      excludeTemplates: true,
    })

    expect(results.get('#work')?.pinned_desc).toBe('newer')
  })

  test('ignores pin rows that were never pinned', async () => {
    await note('Doc')
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'pin',
      datum_pinned_at: null,
      datum_pinned_content: 'unpinned',
    })
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'pin',
      datum_pinned_at: new Date('2026-01-01'),
      datum_pinned_content: 'real',
    })

    const results = await aggregateTagData(db, ['#work'], {
      excludeTemplates: true,
    })

    expect(results.get('#work')?.pinned_desc).toBe('real')
  })

  describe('template exclusion', () => {
    beforeEach(async () => {
      await note('Doc')
      await note('$Template')
      await datum({
        note_title: '$Template',
        datum_tag: '#work',
        datum_type: 'task',
        datum_status: 'complete',
      })
      await datum({
        note_title: '$Template',
        datum_tag: '#work',
        datum_type: 'pin',
        datum_pinned_at: new Date('2026-06-01'),
        datum_pinned_content: 'from the template',
      })
      await datum({
        note_title: 'Doc',
        datum_tag: '#work',
        datum_type: 'pin',
        datum_pinned_at: new Date('2026-01-01'),
        datum_pinned_content: 'from a real doc',
      })
    })

    test('leaves template tasks and template pins out', async () => {
      const results = await aggregateTagData(db, ['#work'], {
        excludeTemplates: true,
      })

      expect(results.get('#work')?.complete_tasks).toBe(0)
      // The template's pin is newer, so it used to win: the pin queries were
      // the ones that never excluded templates.
      expect(results.get('#work')?.pinned_desc).toBe('from a real doc')
    })

    test('keeps them when a caller asks for a template by name', async () => {
      const results = await aggregateTagData(db, ['#work'], {
        docTitle: '$Template',
        excludeTemplates: false,
      })

      expect(results.get('#work')?.complete_tasks).toBe(1)
    })
  })

  test('narrows to one document', async () => {
    await note('Doc')
    await note('Other')
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 60,
    })
    await datum({
      note_title: 'Other',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 300,
    })

    const everywhere = await aggregateTagData(db, ['#work'], {
      excludeTemplates: true,
    })
    const here = await aggregateTagData(db, ['#work'], {
      docTitle: 'Doc',
      excludeTemplates: false,
    })

    expect(everywhere.get('#work')?.total_time_seconds).toBe(360)
    expect(here.get('#work')?.total_time_seconds).toBe(60)
  })

  test('applies date and document-pattern filters', async () => {
    await note('journal-a')
    await note('notes-b')
    await datum({
      note_title: 'journal-a',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 60,
      time_created: new Date('2026-01-01'),
    })
    await datum({
      note_title: 'journal-a',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 120,
      time_created: new Date('2026-06-01'),
    })
    await datum({
      note_title: 'notes-b',
      datum_tag: '#work',
      datum_type: 'timer',
      datum_time_seconds: 999,
      time_created: new Date('2026-06-01'),
    })

    const byDate = await aggregateTagData(db, ['#work'], {
      fromDate: new Date('2026-03-01'),
      excludeTemplates: true,
    })
    const byPattern = await aggregateTagData(db, ['#work'], {
      docPattern: 'journal-%',
      excludeTemplates: true,
    })

    expect(byDate.get('#work')?.total_time_seconds).toBe(1119)
    expect(byPattern.get('#work')?.total_time_seconds).toBe(180)
  })

  test('skips the pin query when the caller does not want pins', async () => {
    await note('Doc')
    await datum({
      note_title: 'Doc',
      datum_tag: '#work',
      datum_type: 'pin',
      datum_pinned_at: new Date('2026-01-01'),
      datum_pinned_content: 'pinned',
    })

    const results = await aggregateTagData(
      db,
      ['#work'],
      { docTitle: 'Doc', excludeTemplates: false },
      { withPins: false }
    )

    expect(results.get('#work')?.pinned_desc).toBeNull()
  })

  test('does not query at all for an empty tag list', async () => {
    const results = await aggregateTagData(db, [], { excludeTemplates: true })

    expect(results.size).toBe(0)
  })
})

describe('hasAggregateData', () => {
  const empty = {
    tag: '#a',
    complete_tasks: 0,
    incomplete_tasks: 0,
    unset_tasks: 0,
    total_time_seconds: 0,
    pinned_at: null,
    pinned_desc: null,
  }

  test('is false for a tag that was only ever written bare', () => {
    expect(hasAggregateData(empty)).toBe(false)
  })

  test('is true once anything lands on the tag', () => {
    expect(hasAggregateData({ ...empty, unset_tasks: 1 })).toBe(true)
    expect(hasAggregateData({ ...empty, total_time_seconds: 5 })).toBe(true)
    expect(hasAggregateData({ ...empty, pinned_at: new Date() })).toBe(true)
    expect(hasAggregateData({ ...empty, page_time_seconds: 5 })).toBe(true)
  })
})
