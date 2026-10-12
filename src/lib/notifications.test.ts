import { afterEach, expect, test, vi } from 'vitest'
import { createNotificationStore } from './notifications'

afterEach(() => vi.useRealTimers())

test('a newer message gets five seconds and history survives dismissal', () => {
  vi.useFakeTimers()
  const store = createNotificationStore()
  store.error('First')
  vi.advanceTimersByTime(4000)
  const second = store.warning('Second')
  vi.advanceTimersByTime(1000)
  expect(store.getSnapshot().currentId).toBe(second)
  vi.advanceTimersByTime(4000)
  expect(store.getSnapshot().currentId).toBeNull()
  expect(store.getSnapshot().entries.map((entry) => entry.message)).toEqual([
    'Second',
    'First',
  ])
  store.info('Third')
  store.dismiss()
  expect(store.getSnapshot().entries).toHaveLength(3)
  store.clear()
  expect(store.getSnapshot().entries).toEqual([])
})

test('bounds history without truncating message details', () => {
  vi.useFakeTimers()
  const store = createNotificationStore()
  for (let i = 0; i < 60; i++) store.info(String(i))
  const description = 'detail'.repeat(1000)
  store.error('Full error', { description })
  expect(store.getSnapshot().entries).toHaveLength(50)
  expect(store.getSnapshot().entries[0].description).toBe(description)
  expect(store.getSnapshot().entries.at(-1)?.message).toBe('11')
})

test('actions survive message expiry but run only once and expire on navigation', async () => {
  vi.useFakeTimers()
  const store = createNotificationStore()
  const undo = vi.fn()
  const id = store.success('Saved', {
    action: { label: 'Undo', onClick: undo },
  })
  vi.advanceTimersByTime(5000)
  await Promise.all([store.runAction(id), store.runAction(id)])
  expect(undo).toHaveBeenCalledTimes(1)
  const next = store.error('Failed', {
    action: { label: 'Retry', onClick: undo },
  })
  store.expireActions()
  await store.runAction(next)
  expect(undo).toHaveBeenCalledTimes(1)
  expect(store.getSnapshot().entries[0].actionState).toBe('expired')
})

test('action failures become history entries', async () => {
  vi.useFakeTimers()
  const store = createNotificationStore()
  const id = store.error('Failed', {
    action: {
      label: 'Retry',
      onClick: async () => {
        throw new Error('Offline')
      },
    },
  })
  await store.runAction(id)
  expect(store.getSnapshot().entries[0]).toMatchObject({
    message: 'Retry failed',
    description: 'Error: Offline',
    kind: 'error',
  })
})
