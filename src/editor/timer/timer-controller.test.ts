import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createStore } from 'jotai'
import { docMake, lineMake } from '@/docs/schema'
import type { Timer } from '@/docs/timer'
import { docAtom, globalTimerAtom } from '../state'
import {
  bindTimer,
  hydrateTimer,
  releaseTimer,
  startTimer,
  pauseTimer,
  stopAndSaveTimer,
  timerElapsedSeconds,
} from './timer-controller'
const api = vi.hoisted(() => ({ start: vi.fn(), change: vi.fn() }))
vi.mock('@/api/client', () => ({ orpcClient: { timers: api } }))
vi.mock('./timer-notifications', () => ({
  showTimerStartedNotification: vi.fn(),
}))
vi.mock('@/lib/notifications', () => ({
  notifications: { info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10000)
})
afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})
const setup = () => {
  const store = createStore()
  const line = lineMake(0, 'task')
  store.set(docAtom, docMake([line]))
  const timer: Timer = {
    id: 'timer',
    noteTitle: 'Work',
    lineId: line.id,
    lineContent: 'task',
    mode: 'stopwatch',
    timeMode: 'replacement',
    accumulatedMs: 0,
    runningSince: 10000,
    targetDuration: 60,
    baseTimeSeconds: null,
    completedAt: null,
    completionError: null,
    revision: 0,
  }
  const flush = vi.fn().mockResolvedValue(undefined)
  const refresh = vi.fn().mockResolvedValue(undefined)
  bindTimer(store, { title: 'Work', flush, refresh })
  hydrateTimer(store, null)
  return { store, line, timer, flush, refresh }
}

test('starting flushes the line before persisting and does not mutate its document', async () => {
  const { store, line, flush, refresh, timer } = setup()
  const before = store.get(docAtom)
  api.start.mockImplementation(async () => {
    expect(flush).toHaveBeenCalled()
    return timer
  })
  expect(
    await startTimer(store, {
      line,
      mode: 'stopwatch',
      timeMode: 'replacement',
      targetDuration: 60,
    })
  ).toBe(true)
  expect(api.start).toHaveBeenCalledWith(
    expect.objectContaining({ noteTitle: 'Work', lineId: line.id })
  )
  expect(store.get(docAtom)).toBe(before)
  expect(refresh).toHaveBeenCalled()
})

test('failed flush prevents starting and saving a timer', async () => {
  const { store, line, timer, flush } = setup()
  flush.mockRejectedValue(new Error('unsaved edits'))
  expect(
    await startTimer(store, {
      line,
      mode: 'stopwatch',
      timeMode: 'replacement',
      targetDuration: 60,
    })
  ).toBe(false)
  expect(api.start).not.toHaveBeenCalled()
  hydrateTimer(store, timer)
  expect(await stopAndSaveTimer(store)).toBe(false)
  expect(api.change).not.toHaveBeenCalled()
  expect(store.get(globalTimerAtom).isActive).toBe(true)
})

test('unmount only detaches; a fresh view restores the same running timer', () => {
  const { store, timer } = setup()
  hydrateTimer(store, timer)
  releaseTimer(store)
  expect(api.change).not.toHaveBeenCalled()
  const other = createStore()
  bindTimer(other, {
    title: 'Other',
    flush: async () => {},
    refresh: async () => {},
  })
  hydrateTimer(other, timer, 15000)
  expect(timerElapsedSeconds(other.get(globalTimerAtom))).toBe(5)
  expect(other.get(globalTimerAtom).noteTitle).toBe('Work')
})

test('network failure leaves the timer visible and never saves elapsed time locally', async () => {
  const { store, timer } = setup()
  hydrateTimer(store, timer)
  const before = store.get(docAtom)
  api.change.mockRejectedValue(new Error('offline'))
  expect(await pauseTimer(store)).toBe(false)
  expect(store.get(globalTimerAtom).runningSince).toBe(10000)
  expect(store.get(docAtom)).toBe(before)
})

test('elapsed display accounts for the server clock and paused segments', () => {
  const { store, timer } = setup()
  hydrateTimer(
    store,
    { ...timer, accumulatedMs: 2000, runningSince: 95000 },
    100000
  )
  expect(timerElapsedSeconds(store.get(globalTimerAtom))).toBe(7)
  vi.advanceTimersByTime(3000)
  expect(timerElapsedSeconds(store.get(globalTimerAtom))).toBe(10)
  hydrateTimer(store, { ...timer, runningSince: null, accumulatedMs: 7000 })
  vi.advanceTimersByTime(10000)
  expect(timerElapsedSeconds(store.get(globalTimerAtom))).toBe(7)
})
