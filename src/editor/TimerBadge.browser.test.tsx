import { afterEach, expect, test } from 'vitest'
import { page } from '@vitest/browser/context'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { TimerBadge } from './TimerBadge'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, globalTimerAtom, timerRowRequestAtom } from './state'
import '@/styles/styles.css'

afterEach(async () => {
  cleanup()
  await page.viewport(1280, 800)
})

test('timer popover fits a narrow screen and holds the running controls', async () => {
  await page.viewport(320, 568)
  const store = createStore()
  const line = lineMake(0, 'A long task name '.repeat(20))
  store.set(docAtom, docMake([line]))
  store.set(globalTimerAtom, {
    ...store.get(globalTimerAtom),
    isActive: true,
    mode: 'countdown',
    lineId: line.id,
    runningSince: null,
  })
  const view = render(
    <Provider store={store}>
      <div className="ELine flex flex-wrap">
        <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={0} />
      </div>
    </Provider>
  )
  expect(view.queryByRole('button', { name: 'Resume' })).toBeNull()
  fireEvent.click(view.getByRole('button', { name: 'Time for line 1' }))
  const popup = await view.findByRole('dialog', { name: 'Timer for line 1' })
  view.getByRole('button', { name: 'Resume' })
  view.getByRole('button', { name: /^Stop and set to/ })
  view.getByRole('button', { name: '+5m' })
  view.getByRole('button', { name: 'Discard this session' })
  expect(popup.getBoundingClientRect().right).toBeLessThanOrEqual(320)
  expect(popup.scrollWidth).toBeLessThanOrEqual(popup.clientWidth)
})

test('running chip shows logged time plus the live session', () => {
  const store = createStore()
  const line = lineMake(0, 'task', { datumTimeSeconds: 1200 })
  store.set(docAtom, docMake([line]))
  store.set(globalTimerAtom, {
    ...store.get(globalTimerAtom),
    isActive: true,
    mode: 'stopwatch',
    timeMode: 'additive',
    lineId: line.id,
    accumulatedMs: 5000,
    runningSince: null,
  })
  const view = render(
    <Provider store={store}>
      <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={1200} />
    </Provider>
  )
  expect(
    view.getByRole('button', { name: 'Time for line 1' }).textContent
  ).toBe('20m + 5s')
})

test('manual entry follows the add or replace setting', async () => {
  const store = createStore()
  const line = lineMake(0, 'task', { datumTimeSeconds: 600 })
  store.set(docAtom, docMake([line]))
  const view = render(
    <Provider store={store}>
      <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={600} />
    </Provider>
  )
  const chip = view.getByRole('button', { name: 'Time for line 1' })
  fireEvent.click(chip)
  await view.findByRole('dialog', { name: 'Timer for line 1' })
  view.getByRole('button', { name: 'Start stopwatch' })
  fireEvent.click(view.getByRole('button', { name: 'Countdown' }))
  view.getByRole('button', { name: '25m' })
  fireEvent.click(view.getByRole('button', { name: 'Add' }))
  fireEvent.click(view.getByRole('button', { name: 'Manual' }))
  fireEvent.change(view.getByLabelText('Time to log'), {
    target: { value: '45m' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Add time' }))
  expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(3300)
  fireEvent.click(chip)
  await view.findByRole('dialog', { name: 'Timer for line 1' })
  fireEvent.click(view.getByRole('button', { name: 'Replace' }))
  fireEvent.click(view.getByRole('button', { name: 'Manual' }))
  fireEvent.change(view.getByLabelText('Time to log'), {
    target: { value: '1h 20m' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Set time' }))
  expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(4800)
})

test('add or replace is fixed while a timer runs', async () => {
  const store = createStore()
  const line = lineMake(0, 'task', { datumTimeSeconds: 1200 })
  store.set(docAtom, docMake([line]))
  store.set(globalTimerAtom, {
    ...store.get(globalTimerAtom),
    isActive: true,
    timeMode: 'replacement',
    lineId: line.id,
    accumulatedMs: 5000,
    runningSince: null,
  })
  const view = render(
    <Provider store={store}>
      <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={1200} />
    </Provider>
  )
  const chip = view.getByRole('button', { name: 'Time for line 1' })
  expect(chip.textContent).toBe('5s')
  fireEvent.click(chip)
  await view.findByRole('dialog', { name: 'Timer for line 1' })
  expect(
    (view.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled
  ).toBe(true)
})

test('a line without time has no hover timer but still opens from a shortcut', async () => {
  const store = createStore()
  const line = lineMake(0, 'Task')
  store.set(docAtom, docMake([line]))
  const view = render(
    <Provider store={store}>
      <div className="ELine">
        <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={0} />
      </div>
    </Provider>
  )
  expect(
    view.queryByRole('button', { name: 'Start a timer on line 1' })
  ).toBeNull()
  expect(view.queryByRole('button', { name: 'Time for line 1' })).toBeNull()
  store.set(timerRowRequestAtom, { lineIdx: 0, mode: 'countdown' })
  const popup = await view.findByRole('dialog', { name: 'Timer for line 1' })
  expect(popup.getBoundingClientRect().width).toBeGreaterThan(0)
  expect(popup.getBoundingClientRect().left).toBeGreaterThanOrEqual(0)
})

test('a toggled timer with no time yet shows only its icon', () => {
  const store = createStore()
  const line = lineMake(0, 'Task', { datumTimeSeconds: 0 })
  store.set(docAtom, docMake([line]))
  const view = render(
    <Provider store={store}>
      <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={0} />
    </Provider>
  )
  const chip = view.getByRole('button', { name: 'Time for line 1' })
  expect(chip.textContent).toBe('')
  expect(chip.querySelector('svg')).not.toBeNull()
})
