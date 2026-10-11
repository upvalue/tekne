// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import type { Kysely } from 'kysely'
import { createRouterClient } from '@orpc/server'
import type { Database } from '@/db/types'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake } from '@/docs/schema'
import { docRouter, upsertNoteInTx } from './doc'
import { timersRouter } from './timers'
import { changeTimer, completeDueTimers } from '../lib/timers'

let db: Kysely<Database>
let timers: ReturnType<typeof createClient>
const createClient = () => createRouterClient(timersRouter, { context: { db } })
beforeAll(async () => {
  ;({ db } = await makeTestDb())
  timers = createClient()
}, 60000)
afterAll(async () => {
  await db.destroy()
})
beforeEach(async () => {
  await db.deleteFrom('timers').execute()
  await db.deleteFrom('notes').execute()
})
const setup = async (
  mode: 'stopwatch' | 'countdown' = 'stopwatch',
  timeMode: 'additive' | 'replacement' = 'replacement'
) => {
  const line = lineMake(0, 'task #work', { datumTimeSeconds: 10 })
  await upsertNoteInTx(db, 'Work', docMake([line]))
  const input = {
    id: crypto.randomUUID(),
    noteTitle: 'Work',
    lineId: line.id,
    mode,
    timeMode,
    targetDuration: 60,
  }
  return { line, input, timer: await timers.start(input) }
}
const note = () =>
  db
    .selectFrom('notes')
    .selectAll()
    .where('title', '=', 'Work')
    .executeTakeFirstOrThrow()

test('start persists once without touching the document; another client sees it', async () => {
  const { input, timer } = await setup()
  expect(await timers.start(input)).toEqual(timer)
  expect((await createClient().list()).timers).toEqual([timer])
  expect((await note()).revision).toBe(0)
  await expect(
    timers.start({ ...input, id: crypto.randomUUID() })
  ).rejects.toMatchObject({ code: 'CONFLICT' })
})

test('pause and resume exclude paused time and reject stale device actions', async () => {
  const { timer } = await setup()
  const paused = await changeTimer(
    db,
    { id: timer.id, revision: 0, action: 'pause' },
    timer.runningSince! + 5000
  )
  expect(paused).toMatchObject({
    runningSince: null,
    accumulatedMs: 5000,
    revision: 1,
  })
  await expect(
    changeTimer(db, { id: timer.id, revision: 0, action: 'resume' })
  ).rejects.toMatchObject({ code: 'CONFLICT' })
  const resumed = await changeTimer(
    db,
    { id: timer.id, revision: 1, action: 'resume' },
    timer.runningSince! + 65000
  )
  expect(resumed?.accumulatedMs).toBe(5000)
  await changeTimer(
    db,
    { id: timer.id, revision: 2, action: 'save' },
    timer.runningSince! + 68000
  )
  expect((await note()).body.children[0].datumTimeSeconds).toBe(8)
})

test('save locates a reordered, edited line and adds to its latest recorded time exactly once', async () => {
  const { line, timer } = await setup('stopwatch', 'additive')
  await upsertNoteInTx(
    db,
    'Work',
    docMake([
      lineMake(0, 'new'),
      {
        ...line,
        mdContent: 'edited #new',
        datumTimeSeconds: 20,
        datumTaskStatus: 'complete',
      },
    ])
  )
  const action = { id: timer.id, revision: 0, action: 'save' as const }
  await Promise.all([
    changeTimer(db, action, timer.runningSince! + 5000),
    changeTimer(db, action, timer.runningSince! + 5000),
  ])
  expect((await note()).body.children[1]).toMatchObject({
    id: line.id,
    mdContent: 'edited #new',
    datumTimeSeconds: 25,
    datumTaskStatus: 'complete',
  })
  expect((await note()).revision).toBe(2)
  const data = await db
    .selectFrom('note_data')
    .selectAll()
    .where('datum_type', '=', 'timer')
    .executeTakeFirstOrThrow()
  expect(Number(data.datum_time_seconds)).toBe(25)
  expect(data.line_id).toBe(line.id)
  expect((await timers.list()).timers).toEqual([])
})

test('replacement conflicts freeze time for explicit resolution without overwriting manual edits', async () => {
  const { line, timer } = await setup()
  await upsertNoteInTx(db, 'Work', docMake([{ ...line, datumTimeSeconds: 20 }]))
  const retained = await changeTimer(
    db,
    { id: timer.id, revision: 0, action: 'save' },
    timer.runningSince! + 5000
  )
  expect(retained).toMatchObject({
    completionError: 'time_changed',
    runningSince: null,
    accumulatedMs: 5000,
  })
  expect((await note()).body.children[0].datumTimeSeconds).toBe(20)
  const other = await timers.start({
    id: crypto.randomUUID(),
    noteTitle: 'Work',
    lineId: line.id,
    mode: 'stopwatch',
    timeMode: 'additive',
    targetDuration: 60,
  })
  await timers.change({
    id: other.id,
    revision: other.revision,
    action: 'discard',
  })
  await timers.change({
    id: timer.id,
    revision: retained!.revision,
    action: 'retarget',
    target: {
      noteTitle: 'Work',
      lineId: line.id,
      timeMode: 'additive',
      expectedTimeSeconds: 20,
    },
  })
  expect((await note()).body.children[0].datumTimeSeconds).toBe(25)
})

test('missing lines and deleted documents retain elapsed time and can be assigned elsewhere', async () => {
  const { timer } = await setup()
  await db.deleteFrom('notes').where('title', '=', 'Work').execute()
  const retained = await changeTimer(
    db,
    { id: timer.id, revision: 0, action: 'save' },
    timer.runningSince! + 7000
  )
  expect(retained).toMatchObject({
    completionError: 'missing_line',
    accumulatedMs: 7000,
    runningSince: null,
  })
  const target = lineMake(0, 'replacement target')
  await upsertNoteInTx(db, 'New', docMake([target]))
  await timers.change({
    id: timer.id,
    revision: retained!.revision,
    action: 'retarget',
    target: {
      noteTitle: 'New',
      lineId: target.id,
      timeMode: 'replacement',
      expectedTimeSeconds: null,
    },
  })
  const saved = await db
    .selectFrom('notes')
    .select('body')
    .where('title', '=', 'New')
    .executeTakeFirstOrThrow()
  expect(saved.body.children[0].datumTimeSeconds).toBe(7)
})

test('renaming the document carries the timer reference with it', async () => {
  const { timer } = await setup()
  const docs = createRouterClient(docRouter, { context: { db } })
  await docs.renameDocExecute({ oldName: 'Work', newName: 'Renamed' })
  expect((await timers.list()).timers[0].noteTitle).toBe('Renamed')
  await changeTimer(
    db,
    { id: timer.id, revision: 0, action: 'save' },
    timer.runningSince! + 4000
  )
  expect(
    (await docs.loadDoc({ name: 'Renamed' })).doc.children[0].datumTimeSeconds
  ).toBe(4)
})

test('the server completes expired countdowns without a browser, capped at their deadline', async () => {
  const { timer } = await setup('countdown')
  await db
    .updateTable('timers')
    .set({ running_since: Date.now() - 120000 })
    .where('id', '=', timer.id)
    .execute()
  await completeDueTimers(db)
  await completeDueTimers(db)
  expect((await note()).body.children[0].datumTimeSeconds).toBe(60)
  expect((await note()).revision).toBe(1)
  expect((await timers.list()).timers).toHaveLength(0)
})

test('completion refuses an early client clock and discard leaves the document untouched', async () => {
  const { timer } = await setup('countdown')
  expect(
    await changeTimer(
      db,
      { id: timer.id, revision: 0, action: 'complete' },
      timer.runningSince! + 1000
    )
  ).toEqual(timer)
  await timers.change({ id: timer.id, revision: 0, action: 'discard' })
  expect((await note()).revision).toBe(0)
  expect((await note()).body.children[0].datumTimeSeconds).toBe(10)
})

test('status uses current text and surrounding lines and never changes expired timers', async () => {
  const { timer, line } = await setup('countdown')
  await upsertNoteInTx(
    db,
    'Work',
    docMake([
      lineMake(0, 'before'),
      { ...line, mdContent: 'edited', indent: 1 },
      lineMake(0, 'after'),
    ])
  )
  await db
    .updateTable('timers')
    .set({ running_since: Date.now() - 120000 })
    .where('id', '=', timer.id)
    .execute()
  const before = await note()
  const status = await timers.status()
  expect(status.timers[0]).toMatchObject({
    context: 'Work\nbefore\n  edited\nafter',
    lineContent: 'edited',
  })
  expect(await note()).toEqual(before)
  expect((await timers.list()).timers).toHaveLength(1)
})
