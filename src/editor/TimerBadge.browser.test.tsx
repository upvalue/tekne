import { afterEach, expect, test } from 'vitest'
import { page } from '@vitest/browser/context'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { TimerBadge } from './TimerBadge'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, globalTimerAtom } from './state'
import '@/styles/styles.css'

afterEach(async () => {
  cleanup()
  await page.viewport(1280, 800)
})

test('mobile timer stays inside the viewport and opens the active countdown controls', async () => {
  await page.viewport(320, 568)
  const store = createStore()
  const line = lineMake(0, 'A long task name '.repeat(20))
  store.set(docAtom, docMake([line]))
  store.set(globalTimerAtom, {
    ...store.get(globalTimerAtom),
    isActive: true,
    mode: 'countdown',
    lineTimeCreated: line.timeCreated,
    runningSince: null,
  })
  const view = render(
    <Provider store={store}>
      <TimerBadge lineInfo={{ line, lineIdx: 0 }} time={0} />
    </Provider>
  )
  fireEvent.click(view.getByRole('button'))
  const dialog = await view.findByRole('dialog')
  const resume = view.getByRole('button', { name: 'Resume' })
  view.getByRole('button', { name: 'Stop & Save' })
  await act(() => new Promise((resolve) => setTimeout(resolve, 250)))
  const bounds = dialog.getBoundingClientRect()
  expect(bounds.left).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(320)
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.bottom).toBeLessThanOrEqual(568)
  expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
  expect(resume.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  await act(() => page.viewport(320, 320))
  await waitFor(() =>
    expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(288)
  )
  resume.scrollIntoView()
  expect(resume.getBoundingClientRect().bottom).toBeLessThanOrEqual(320)
})
