import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  SAVE_DEBOUNCE_MS,
  SAVE_MAX_WAIT_MS,
  SAVE_RETRY_MS,
  SaveConflictError,
  SaveQueue,
  type SaveResult,
} from './save-queue'

type Doc = { text: string }

/** A queue over a mutable doc with manually resolvable save requests. */
const makeQueue = (opts?: { revision?: number }) => {
  const doc = { text: 'initial' }
  const requests: Array<{
    snapshot: Doc
    expectedRevision: number
    resolve: (result: SaveResult<Doc>) => void
    reject: (error: unknown) => void
  }> = []
  const onSaved = vi.fn()
  const onConflict = vi.fn()
  const onSaveError = vi.fn()
  const queue = new SaveQueue<Doc>({
    revision: opts?.revision ?? 0,
    getSnapshot: () => ({ ...doc }),
    performSave: (snapshot, expectedRevision) =>
      new Promise((resolve, reject) => {
        requests.push({ snapshot, expectedRevision, resolve, reject })
      }),
    onSaved,
    onConflict,
    onSaveError,
  })
  const edit = (text: string) => {
    doc.text = text
    queue.noteEdit()
  }
  return { queue, doc, requests, edit, onSaved, onConflict, onSaveError }
}

/** Let pending promise reactions run without advancing timers. */
const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('debounce and max wait', () => {
  test('rapid edits collapse into one request after the debounce', async () => {
    const { requests, edit } = makeQueue()
    edit('a')
    edit('ab')
    edit('abc')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1)
    expect(requests).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(requests).toHaveLength(1)
    expect(requests[0].snapshot.text).toBe('abc')
  })

  test('continuous editing saves once the max wait elapses', async () => {
    const { requests, edit } = makeQueue()
    // Keep editing more often than the debounce so it never fires on its own
    for (let elapsed = 0; elapsed < SAVE_MAX_WAIT_MS; elapsed += 500) {
      edit(`edit at ${elapsed}`)
      await vi.advanceTimersByTimeAsync(500)
    }
    expect(requests).toHaveLength(1)
  })
})

describe('serialization and acknowledgment', () => {
  test('edits during an in-flight request stay dirty and go in a later request', async () => {
    const { queue, requests, edit, onSaved } = makeQueue()
    edit('first')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(requests).toHaveLength(1)

    edit('second') // while request 1 is in flight
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS)
    // Still only one request: nothing overlaps
    expect(requests).toHaveLength(1)

    requests[0].resolve({ status: 'ok', revision: 1 })
    await settle()
    // The ack covers 'first' only; the queue is still dirty
    expect(onSaved).toHaveBeenCalledWith({ text: 'first' }, 1)
    expect(queue.isDirty()).toBe(true)

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(requests).toHaveLength(2)
    expect(requests[1].snapshot.text).toBe('second')
    expect(requests[1].expectedRevision).toBe(1)

    requests[1].resolve({ status: 'ok', revision: 2 })
    await settle()
    expect(queue.isDirty()).toBe(false)
  })

  test('a slow request never overlaps with a later scheduled save', async () => {
    const { requests, edit } = makeQueue()
    edit('one')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    edit('two')
    // Request 1 stays unresolved well past every timer
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS * 3)
    expect(requests).toHaveLength(1)
  })
})

describe('flush', () => {
  test('resolves immediately when clean', async () => {
    const { queue } = makeQueue()
    await expect(queue.flush()).resolves.toBeUndefined()
  })

  test('drains edits made during an earlier request', async () => {
    const { queue, requests, edit } = makeQueue()
    edit('first')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    edit('second')

    const flushed = vi.fn()
    const flush = queue.flush().then(flushed)

    requests[0].resolve({ status: 'ok', revision: 1 })
    await settle()
    // 'second' is not acknowledged yet, so the flush must still be pending,
    // and draining starts immediately rather than waiting for the debounce
    expect(flushed).not.toHaveBeenCalled()
    expect(requests).toHaveLength(2)

    requests[1].resolve({ status: 'ok', revision: 2 })
    await settle()
    await flush
    expect(flushed).toHaveBeenCalled()
  })

  test('starts the save immediately instead of waiting for the debounce', async () => {
    const { queue, requests, edit } = makeQueue()
    edit('a')
    void queue.flush().catch(() => {})
    expect(requests).toHaveLength(1)
  })

  test('rejects when the save fails and the document stays dirty', async () => {
    const { queue, requests, edit, onSaveError } = makeQueue()
    edit('a')
    const flush = queue.flush()
    requests[0].reject(new Error('network down'))
    await expect(flush).rejects.toThrow('network down')
    expect(queue.isDirty()).toBe(true)
    expect(onSaveError).toHaveBeenCalledOnce()
  })
})

describe('failures', () => {
  test('a failed autosave retries and eventually succeeds', async () => {
    const { queue, requests, edit } = makeQueue()
    edit('a')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    requests[0].reject(new Error('boom'))
    await settle()

    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MS)
    expect(requests).toHaveLength(2)
    requests[1].resolve({ status: 'ok', revision: 1 })
    await settle()
    expect(queue.isDirty()).toBe(false)
  })
})

describe('dispose and activate', () => {
  test('a dispose/activate cycle (React StrictMode) keeps the queue working', async () => {
    const { queue, requests, edit } = makeQueue()
    // StrictMode runs the effect cleanup and setup once on the same instance
    queue.dispose()
    queue.activate()

    edit('a')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(requests).toHaveLength(1)
  })

  test('activating a dirty queue reschedules its save', async () => {
    const { queue, requests, edit } = makeQueue()
    edit('a')
    queue.dispose()
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS)
    expect(requests).toHaveLength(0)

    queue.activate()
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(requests).toHaveLength(1)
  })
})

describe('conflicts', () => {
  test('a conflict pauses autosave and preserves dirtiness', async () => {
    const { queue, requests, edit, onConflict } = makeQueue()
    edit('mine')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    requests[0].resolve({
      status: 'conflict',
      serverDoc: { text: 'theirs' },
      serverRevision: 7,
    })
    await settle()

    expect(onConflict).toHaveBeenCalledOnce()
    expect(queue.isDirty()).toBe(true)
    await expect(queue.flush()).rejects.toBeInstanceOf(SaveConflictError)

    // Edits and time do not produce requests while unresolved
    edit('more')
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS * 2)
    expect(requests).toHaveLength(1)
  })

  test('keep-mine resends the local snapshot at the server revision', async () => {
    const { queue, requests, edit } = makeQueue()
    edit('mine')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    requests[0].resolve({
      status: 'conflict',
      serverDoc: { text: 'theirs' },
      serverRevision: 7,
    })
    await settle()

    queue.resolveKeepMine()
    expect(requests).toHaveLength(2)
    expect(requests[1].snapshot.text).toBe('mine')
    expect(requests[1].expectedRevision).toBe(7)
    requests[1].resolve({ status: 'ok', revision: 8 })
    await settle()
    expect(queue.isDirty()).toBe(false)
  })

  test('take-server marks the queue clean at the server revision', async () => {
    const { queue, requests, edit } = makeQueue()
    edit('mine')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    requests[0].resolve({
      status: 'conflict',
      serverDoc: { text: 'theirs' },
      serverRevision: 7,
    })
    await settle()

    queue.resolveTakeServer()
    expect(queue.isDirty()).toBe(false)
    await expect(queue.flush()).resolves.toBeUndefined()

    // The next edit saves against the adopted server revision
    edit('later')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(requests[1].expectedRevision).toBe(7)
  })
})
