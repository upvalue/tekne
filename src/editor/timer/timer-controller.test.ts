import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStore } from 'jotai'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, globalTimerAtom } from '../state'
import {
  cancelTimer,
  isTimerPaused,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopAndSaveTimer,
  timerElapsedSeconds,
  timerRemainingSeconds,
} from './timer-controller'
import { playTimerCompleteSound } from '@/lib/sound'

vi.mock('@/api/client', () => ({
  orpcClient: { execHook: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/lib/sound', () => ({ playTimerCompleteSound: vi.fn() }))

type Store = ReturnType<typeof createStore>

const makeStore = (): Store => {
  const store = createStore()
  store.set(docAtom, docMake([lineMake(0, 'task a'), lineMake(0, 'task b')]))
  return store
}

const lineAt = (store: Store, idx: number) => store.get(docAtom).children[idx]

const startStopwatch = (
  store: Store,
  idx = 0,
  timeMode: 'additive' | 'replacement' = 'replacement'
) =>
  startTimer(store, {
    line: lineAt(store, idx),
    mode: 'stopwatch',
    timeMode,
    targetDuration: 1800,
  })

describe('timer-controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test('stopwatch accrues and stop saves elapsed time', () => {
    const store = makeStore()
    startStopwatch(store)
    vi.advanceTimersByTime(5000)
    expect(timerElapsedSeconds(store.get(globalTimerAtom))).toBe(5)
    stopAndSaveTimer(store)
    expect(lineAt(store, 0).datumTimeSeconds).toBe(5)
    expect(store.get(globalTimerAtom).isActive).toBe(false)
  })

  test('paused time is excluded from the saved duration', () => {
    const store = makeStore()
    startStopwatch(store)
    vi.advanceTimersByTime(5000)
    pauseTimer(store)
    expect(isTimerPaused(store.get(globalTimerAtom))).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(timerElapsedSeconds(store.get(globalTimerAtom))).toBe(5)
    resumeTimer(store)
    expect(isTimerPaused(store.get(globalTimerAtom))).toBe(false)
    vi.advanceTimersByTime(3000)
    expect(timerElapsedSeconds(store.get(globalTimerAtom))).toBe(8)
    stopAndSaveTimer(store)
    expect(lineAt(store, 0).datumTimeSeconds).toBe(8)
  })

  test('pause and resume no-op when they do not apply', () => {
    const store = makeStore()
    pauseTimer(store)
    resumeTimer(store)
    expect(store.get(globalTimerAtom).isActive).toBe(false)

    startStopwatch(store)
    const running = store.get(globalTimerAtom)
    resumeTimer(store)
    expect(store.get(globalTimerAtom)).toEqual(running)
    pauseTimer(store)
    const paused = store.get(globalTimerAtom)
    pauseTimer(store)
    expect(store.get(globalTimerAtom)).toEqual(paused)
  })

  test('additive mode adds to the existing line time', () => {
    const store = makeStore()
    store.set(docAtom, (draft) => {
      draft.children[0].datumTimeSeconds = 100
    })
    startStopwatch(store, 0, 'additive')
    vi.advanceTimersByTime(7000)
    stopAndSaveTimer(store)
    expect(lineAt(store, 0).datumTimeSeconds).toBe(107)
  })

  test('countdown completes at zero and saves the target duration', () => {
    const store = makeStore()
    startTimer(store, {
      line: lineAt(store, 0),
      mode: 'countdown',
      timeMode: 'replacement',
      targetDuration: 10,
    })
    vi.advanceTimersByTime(10_000)
    expect(store.get(globalTimerAtom).isActive).toBe(false)
    expect(lineAt(store, 0).datumTimeSeconds).toBe(10)
    expect(playTimerCompleteSound).toHaveBeenCalled()
  })

  test('a paused countdown does not complete', () => {
    const store = makeStore()
    startTimer(store, {
      line: lineAt(store, 0),
      mode: 'countdown',
      timeMode: 'replacement',
      targetDuration: 3,
    })
    vi.advanceTimersByTime(1000)
    pauseTimer(store)
    vi.advanceTimersByTime(60_000)
    const timer = store.get(globalTimerAtom)
    expect(timer.isActive).toBe(true)
    expect(timerRemainingSeconds(timer)).toBe(2)
  })

  test('startTimer refuses while another line is active', () => {
    const store = makeStore()
    startStopwatch(store, 0)
    startStopwatch(store, 1)
    expect(store.get(globalTimerAtom).lineTimeCreated).toBe(
      lineAt(store, 0).timeCreated
    )
  })

  test('cancelTimer discards elapsed time', () => {
    const store = makeStore()
    startStopwatch(store)
    vi.advanceTimersByTime(5000)
    cancelTimer(store)
    expect(store.get(globalTimerAtom).isActive).toBe(false)
    expect(lineAt(store, 0).datumTimeSeconds).toBeUndefined()
  })
})
