import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { createStore, Provider } from 'jotai'
import { afterEach, expect, test } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { displayModeAtom } from '@/hooks/display-mode'
import { uiStore } from '@/hooks/panel-state'
import { TEditor } from './TEditor'
import { docAtom } from './state'
import {
  touchEditingLineIdAtom,
  touchSelectedLineIdAtom,
} from './touch/touch-atoms'
import '@/styles/styles.css'

afterEach(async () => {
  cleanup()
  uiStore.set(displayModeAtom, 'desktop')
  await page.viewport(1280, 800)
})

test.each([320, 390])(
  'editor keeps a 12px outer gutter and outline indentation at %ipx',
  async (width) => {
    await page.viewport(width, 800)
    uiStore.set(displayModeAtom, 'touch')
    const store = createStore()
    const lines = [
      lineMake(0, 'A long line of text that wraps naturally '.repeat(4)),
      lineMake(1, 'An indented line'),
      lineMake(1, 'A task with a timer and a longer description '.repeat(3), {
        datumTaskStatus: 'incomplete',
        datumTimeSeconds: 5400,
      }),
    ]
    store.set(docAtom, docMake(lines))
    const view = render(
      <Provider store={store}>
        <TEditor />
      </Provider>
    )
    const editor = view.container.querySelector<HTMLElement>('.TEditor-scroll')!
    const rows = Array.from(
      view.container.querySelectorAll<HTMLElement>('.ELine')
    )
    expect(getComputedStyle(editor).paddingLeft).toBe('12px')
    expect(getComputedStyle(editor).paddingRight).toBe('12px')
    expect(rows[0].getBoundingClientRect().left).toBe(12)
    expect(rows[0].getBoundingClientRect().right).toBe(width - 12)
    expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth)
    const plainText = rows[0].querySelector('.cm-editor-container')!
    const indentedText = rows[1].querySelector('.cm-editor-container')!
    expect(
      indentedText.getBoundingClientRect().left -
        plainText.getBoundingClientRect().left
    ).toBe(24)
    for (const row of rows) {
      expect(getComputedStyle(row).paddingTop).toBe('4px')
      expect(getComputedStyle(row).paddingBottom).toBe('4px')
      expect(
        getComputedStyle(row.querySelector('.ELine-gutter')!).display
      ).toBe('none')
      const touchTarget = row.querySelector('.ELine-touch-overlay')!
      expect(touchTarget.getBoundingClientRect().height).toBe(
        row.getBoundingClientRect().height
      )
    }

    // Selection, repeat-tap editing and switching lines keep the same targets.
    fireEvent.click(view.getByRole('button', { name: 'Select line 1' }))
    expect(store.get(touchSelectedLineIdAtom)).toBe(lines[0].timeCreated)
    fireEvent.click(view.getByRole('button', { name: 'Select line 1' }))
    await waitFor(() =>
      expect(store.get(touchEditingLineIdAtom)).toBe(lines[0].timeCreated)
    )
    fireEvent.click(view.getByRole('button', { name: 'Select line 2' }))
    expect(store.get(touchSelectedLineIdAtom)).toBe(lines[1].timeCreated)
    expect(store.get(touchEditingLineIdAtom)).toBeNull()
  }
)

test('desktop gutter and zero outer inset return at the 768px breakpoint', async () => {
  await page.viewport(768, 800)
  const store = createStore()
  store.set(docAtom, docMake([lineMake(0, 'Desktop line')]))
  const view = render(
    <Provider store={store}>
      <TEditor />
    </Provider>
  )
  const editor = view.container.querySelector('.TEditor-scroll')!
  const gutter = view.container.querySelector('.ELine-gutter')!
  expect(getComputedStyle(editor).paddingLeft).toBe('0px')
  expect(getComputedStyle(editor).paddingRight).toBe('0px')
  expect(getComputedStyle(gutter).display).toBe('grid')
  expect(gutter.getBoundingClientRect().width).toBe(178)
})
