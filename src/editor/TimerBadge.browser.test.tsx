import { afterEach, expect, test } from 'vitest'
import { page } from '@vitest/browser/context'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { TimerBadge } from './TimerBadge'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, globalTimerAtom } from './state'
import '@/styles/styles.css'

afterEach(async () => {
  cleanup()
  await page.viewport(1280, 800)
})

test('inline timer remains usable on a narrow screen without a modal or mode tabs', async () => {
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
  fireEvent.click(view.getByRole('button', { name: 'Time for line 1' }))
  const row = view.getByRole('region', { name: 'Timer for line 1' })
  expect(view.queryByRole('dialog')).toBeNull()
  expect(view.queryByRole('tab')).toBeNull()
  const resume = view.getByRole('button', { name: 'Resume' })
  view.getByRole('button', { name: /Stop · add/ })
  view.getByRole('button', { name: '+5m' })
  expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(320)
  expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  expect(resume.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
})

test('manual time adds or replaces and exposes all three choices together', () => {
  const store = createStore()
  const line = lineMake(0, 'task', { datumTimeSeconds: 600 })
  store.set(docAtom, docMake([line]))
  const view = render(
    <Provider store={store}>
      <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={600} />
    </Provider>
  )
  fireEvent.click(view.getByRole('button', { name: 'Time for line 1' }))
  view.getByRole('heading', { name: 'Stopwatch' })
  view.getByRole('heading', { name: 'Countdown' })
  view.getByRole('heading', { name: 'Enter time' })
  fireEvent.change(view.getByLabelText('Time to log'), {
    target: { value: '45m' },
  })
  fireEvent.click(view.getByRole('button', { name: /^Add$/ }))
  expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(3300)
  fireEvent.change(view.getByLabelText('Time to log'), {
    target: { value: '1h 20m' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Set total' }))
  expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(4800)
})
