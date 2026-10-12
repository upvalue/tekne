import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  SAVE_RETRY_MS,
  SaveConflictError,
  SaveQueue,
  type SaveQueueState,
  type SaveResult,
} from './save-queue'

type Doc = { text: string }
const makeQueue = (persist?: (state: SaveQueueState<Doc>) => Promise<void>) => {
  let doc = { text: 'initial' }
  const requests: Array<{
    snapshot: Doc
    expectedRevision: number
    requestId: string
    baseline: Doc
    resolve: (result: SaveResult<Doc>) => void
    reject: (error: unknown) => void
  }> = []
  const onSaved = vi.fn()
  const onConflict = vi.fn()
  const onSaveError = vi.fn()
  const onPersistenceError = vi.fn()
  const queue = new SaveQueue<Doc>({
    revision: 0,
    getSnapshot: () => doc,
    persist,
    performSave: (snapshot, expectedRevision, requestId, baseline) =>
      new Promise((resolve, reject) => {
        requests.push({
          snapshot,
          expectedRevision,
          requestId,
          baseline,
          resolve,
          reject,
        })
      }),
    onSaved,
    onConflict,
    onSaveError,
    onPersistenceError,
  })
  const edit = (text: string) => {
    doc = { text }
    queue.noteEdit()
  }
  return {
    queue,
    requests,
    edit,
    onSaved,
    onConflict,
    onSaveError,
    onPersistenceError,
  }
}
const settle = () => vi.advanceTimersByTimeAsync(0)
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('starts sending on the edit itself, without advancing a timer', () => {
  const { edit, requests } = makeQueue()
  edit('first')
  expect(requests).toHaveLength(1)
  expect(requests[0].snapshot.text).toBe('first')
})

test('combines edits during a request and sends the latest immediately on acknowledgement', async () => {
  const { queue, edit, requests } = makeQueue()
  edit('first')
  edit('second')
  edit('third')
  expect(requests).toHaveLength(1)
  requests[0].resolve({ status: 'ok', revision: 1 })
  await settle()
  expect(requests).toHaveLength(2)
  expect(requests[1]).toMatchObject({
    snapshot: { text: 'third' },
    baseline: { text: 'first' },
    expectedRevision: 1,
  })
  expect(queue.isDirty()).toBe(true)
  requests[1].resolve({ status: 'ok', revision: 2 })
  await settle()
  expect(queue.isDirty()).toBe(false)
})

test('waits for a durable local record before sending and records edits during a request', async () => {
  const states: SaveQueueState<Doc>[] = []
  let commit!: () => void
  const { queue, requests, edit } = makeQueue(async (state) => {
    states.push(state)
    if (states.length === 1)
      await new Promise<void>((resolve) => {
        commit = resolve
      })
  })
  edit('first')
  await settle()
  expect(requests).toHaveLength(0)
  edit('second')
  commit()
  await queue.persisted()
  await settle()
  expect(requests).toHaveLength(1)
  expect(states.at(-1)?.snapshot.text).toBe('second')
  expect(states.at(-1)?.attempt?.snapshot.text).toBe('first')
})

test('flush drains every pending edit; a failure rejects and retains dirtiness', async () => {
  const { queue, requests, edit } = makeQueue()
  await queue.flush()
  edit('first')
  edit('second')
  const flushed = vi.fn()
  const pending = queue.flush().then(flushed)
  requests[0].resolve({ status: 'ok', revision: 1 })
  await settle()
  expect(flushed).not.toHaveBeenCalled()
  requests[1].resolve({ status: 'ok', revision: 2 })
  await pending
  edit('third')
  const failed = queue.flush()
  requests[2].reject(new Error('offline'))
  await expect(failed).rejects.toThrow('offline')
  expect(queue.isDirty()).toBe(true)
})

test('lost responses retry exactly before sending later edits; new edits respect retry backoff', async () => {
  const { queue, edit, requests } = makeQueue()
  edit('first')
  requests[0].reject(new Error('response lost'))
  await settle()
  edit('second')
  expect(requests).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(SAVE_RETRY_MS)
  expect(requests[1]).toMatchObject({
    snapshot: requests[0].snapshot,
    requestId: requests[0].requestId,
    expectedRevision: 0,
  })
  requests[1].resolve({ status: 'ok', revision: 1 })
  await settle()
  expect(requests[2].snapshot.text).toBe('second')
  expect(requests[2].requestId).not.toBe(requests[0].requestId)
  requests[2].resolve({ status: 'ok', revision: 2 })
  await settle()
  expect(queue.isDirty()).toBe(false)
})

test('restores an interrupted request and newer local edits, preserving its ID and baseline', async () => {
  let saved!: SaveQueueState<Doc>
  const first = makeQueue(async (state) => {
    saved = structuredClone(state)
  })
  first.edit('sent')
  await settle()
  first.edit('newer')
  await first.queue.persisted()
  first.queue.dispose()
  const second = makeQueue()
  second.queue.restore(saved)
  second.queue.activate()
  expect(second.requests[0]).toMatchObject({
    snapshot: { text: 'sent' },
    requestId: first.requests[0].requestId,
    baseline: { text: 'initial' },
  })
  second.requests[0].resolve({ status: 'ok', revision: 1 })
  await settle()
  expect(second.requests[1].snapshot.text).toBe('newer')
  // The old tab cannot erase a record now owned by its replacement.
  first.requests[0].resolve({ status: 'ok', revision: 1 })
  await settle()
  expect(saved.snapshot.text).toBe('newer')
  expect(saved.ackedGeneration).toBe(0)
})

test('conflicts persist subsequent edits and resolutions use the new baseline', async () => {
  const persist = vi.fn(async (_state: SaveQueueState<Doc>) => {})
  const { queue, edit, requests, onConflict } = makeQueue(persist)
  edit('mine')
  await settle()
  requests[0].resolve({
    status: 'conflict',
    serverDoc: { text: 'theirs' },
    serverRevision: 7,
  })
  await settle()
  expect(onConflict).toHaveBeenCalledOnce()
  edit('more')
  await queue.persisted()
  expect(persist.mock.lastCall![0].snapshot.text).toBe('more')
  expect(persist.mock.lastCall![0].conflict?.serverRevision).toBe(7)
  await expect(queue.flush()).rejects.toBeInstanceOf(SaveConflictError)
  queue.resolveKeepMine()
  await settle()
  expect(requests[1]).toMatchObject({
    expectedRevision: 7,
    baseline: { text: 'theirs' },
    snapshot: { text: 'more' },
  })
  requests[1].resolve({
    status: 'conflict',
    serverDoc: { text: 'latest' },
    serverRevision: 8,
  })
  await settle()
  queue.resolveTakeServer()
  await queue.persisted()
  expect(queue.isDirty()).toBe(false)
  expect(persist.mock.lastCall![0]).toMatchObject({
    baseline: { text: 'latest' },
    conflict: null,
  })
})

test('storage failure is reported but does not prevent server saving', async () => {
  const { edit, requests, onPersistenceError } = makeQueue(async () => {
    throw new Error('disk full')
  })
  edit('keep me')
  await settle()
  expect(onPersistenceError).toHaveBeenCalled()
  expect(requests).toHaveLength(1)
})

test('dispose and activate preserve pending work; explicit discard clears its durable record', async () => {
  const persist = vi.fn(async (_state: SaveQueueState<Doc>) => {})
  const { queue, edit, requests } = makeQueue(persist)
  queue.dispose()
  edit('pending')
  await settle()
  expect(requests).toHaveLength(0)
  queue.activate()
  await settle()
  expect(requests).toHaveLength(1)
  requests[0].reject(new Error('offline'))
  await settle()
  queue.discardLocal()
  await queue.persisted()
  expect(queue.isDirty()).toBe(false)
  const state = persist.mock.lastCall![0]
  expect(state.ackedGeneration).toBe(state.generation)
})
