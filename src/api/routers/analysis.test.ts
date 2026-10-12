// @vitest-environment node
import { beforeAll, afterAll, beforeEach, expect, test } from 'vitest'
import { createRouterClient } from '@orpc/server'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake } from '@/docs/schema'
import { documentContributions, reconcileAggregates } from '@/docs/aggregates'
import { analysisRouter } from './analysis'
import { upsertNoteInTx } from './doc'

let database: Awaited<ReturnType<typeof makeTestDb>>
beforeAll(async () => {
  database = await makeTestDb()
}, 60_000)
afterAll(async () => {
  await database.db.destroy()
})
beforeEach(async () => {
  await database.db.deleteFrom('notes').execute()
})

const snapshot = (title: string, tags = ['#work']) =>
  createRouterClient(analysisRouter, {
    context: { db: database.db },
  }).aggregateSnapshot({ title, tags })

test('local counts match SQL, including inheritance, repeated tags, task states and time', async () => {
  const doc = docMake([
    lineMake(0, '#work', { datumTaskStatus: 'unset' }),
    lineMake(1, '#work', { datumTaskStatus: 'complete', datumTimeSeconds: 90 }),
    lineMake(2, 'child', {
      datumTaskStatus: 'incomplete',
      datumTimeSeconds: 30,
    }),
    lineMake(0, '#bare'),
  ])
  await upsertNoteInTx(database.db, 'Doc', doc)
  const baseline = await snapshot('Doc', ['#work', '#bare', '#new'])
  expect(baseline.revision).toBe(0)
  for (const page of documentContributions(doc).values()) {
    const row = baseline.rows.find((r) => r.tag === page.tag)!
    expect(row.page_complete_tasks).toBe(page.complete_tasks)
    expect(row.page_incomplete_tasks).toBe(page.incomplete_tasks)
    expect(row.page_unset_tasks).toBe(page.unset_tasks)
    expect(row.page_time_seconds).toBe(page.total_time_seconds)
  }
  expect(baseline.rows.find((r) => r.tag === '#new')?.complete_tasks).toBe(0)
})

test('edits stay optimistic across old and refreshed server snapshots without double counting', async () => {
  const doc = docMake([lineMake(0, '#work', { datumTaskStatus: 'unset' })])
  await upsertNoteInTx(database.db, 'Doc', doc)
  await upsertNoteInTx(
    database.db,
    'Other',
    docMake([lineMake(0, '#work', { datumTaskStatus: 'complete' })])
  )
  const old = await snapshot('Doc')
  const local = structuredClone(doc)
  local.children[0].datumTaskStatus = 'complete'
  const optimistic = reconcileAggregates(
    'Doc',
    documentContributions(local),
    old.rows
  )
  expect(optimistic[0]).toMatchObject({
    complete_tasks: 2,
    unset_tasks: 0,
    page_complete_tasks: 1,
  })
  await upsertNoteInTx(database.db, 'Doc', local)
  const saved = await snapshot('Doc')
  expect(saved.revision).toBe(1)
  expect(
    reconcileAggregates('Doc', documentContributions(local), saved.rows)
  ).toEqual(optimistic)
  // Undo while a refresh for the previous edit is in flight.
  expect(
    reconcileAggregates('Doc', documentContributions(doc), saved.rows)[0]
  ).toMatchObject({ complete_tasks: 1, unset_tasks: 1 })
})

test('templates contribute only page totals and local unpin reveals the external pin', async () => {
  const other = lineMake(0, '#work external', {
    datumPinnedAt: '2026-01-01T00:00:00.000Z',
    datumTaskStatus: 'complete',
  })
  const current = lineMake(0, '#work current', {
    datumPinnedAt: '2026-02-01T00:00:00.000Z',
    datumTaskStatus: 'complete',
  })
  await upsertNoteInTx(database.db, 'Other', docMake([other]))
  await upsertNoteInTx(database.db, 'Doc', docMake([current]))
  const baseline = await snapshot('Doc')
  const unpinned = { ...current, datumPinnedAt: undefined }
  expect(
    reconcileAggregates(
      'Doc',
      documentContributions(docMake([unpinned])),
      baseline.rows
    )[0].pinned_desc
  ).toBe(other.mdContent)
  await upsertNoteInTx(
    database.db,
    '$Template',
    docMake([
      lineMake(0, '#work', {
        datumTaskStatus: 'complete',
        datumTimeSeconds: 200,
      }),
    ])
  )
  const template = await snapshot('$Template')
  const liveTemplate = docMake([
    lineMake(0, '#work', {
      datumTaskStatus: 'complete',
      datumTimeSeconds: 300,
    }),
  ])
  expect(
    reconcileAggregates(
      '$Template',
      documentContributions(liveTemplate),
      template.rows
    )[0]
  ).toMatchObject({
    complete_tasks: 2,
    total_time_seconds: 0,
    page_time_seconds: 300,
  })
})
