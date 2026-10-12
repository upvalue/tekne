import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { createStore, Provider } from 'jotai'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, globalTimerAtom } from '../state'
import { RunningTimerPill } from './RunningTimerPill'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup(
  timeMode: 'additive' | 'replacement',
  mode: 'stopwatch' | 'countdown' = 'stopwatch'
) {
  const store = createStore()
  const line = lineMake(0, 'Task', { datumTimeSeconds: 1200 })
  store.set(docAtom, docMake([line]))
  store.set(globalTimerAtom, {
    ...store.get(globalTimerAtom),
    isActive: true,
    timeMode,
    mode,
    lineId: line.id,
    baseTimeSeconds: 1200,
    accumulatedMs: 5000,
    runningSince: null,
    targetDuration: 60,
  })
  render(
    <Provider store={store}>
      <RunningTimerPill />
    </Provider>
  )
  return store
}

test('addition separates recorded time from the live count-up and pauses it', () => {
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  const store = setup('additive')
  const pill = screen.getByRole('button', { name: 'Jump to running timer' })
  expect(pill.textContent).toContain('20:00 + 0:05')
  act(() =>
    store.set(globalTimerAtom, (timer) => ({
      ...timer,
      runningSince: Date.now(),
    }))
  )
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(pill.textContent).toContain('20:00 + 0:07')
  act(() =>
    store.set(globalTimerAtom, (timer) => ({
      ...timer,
      runningSince: null,
      accumulatedMs: 7000,
    }))
  )
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(pill.textContent).toContain('20:00 + 0:07')
})

test('replacement shows only this session', () => {
  setup('replacement')
  expect(screen.getByRole('button').textContent).toContain('0:05')
  expect(screen.getByRole('button').textContent).not.toContain('20:00')
})

test('addition counts up during countdowns and also shows time remaining', () => {
  setup('additive', 'countdown')
  expect(screen.getByRole('button').textContent).toContain(
    '20:00 + 0:05 · 0:55 left'
  )
})
