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
    expect(
      rows[2].querySelector('.TimerChip')!.getBoundingClientRect().right
    ).toBeLessThanOrEqual(
      rows[2].querySelector('.cm-editor-container')!.getBoundingClientRect()
        .left
    )
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
      ).toBe('grid')
      const touchTarget = row.querySelector('.ELine-touch-overlay')!
      expect(touchTarget.getBoundingClientRect().height).toBe(
        row.getBoundingClientRect().height
      )
    }

    // Selection, repeat-tap editing and switching lines keep the same targets.
    fireEvent.click(view.getByRole('button', { name: 'Select line 1' }))
    expect(store.get(touchSelectedLineIdAtom)).toBe(lines[0].id)
    fireEvent.click(view.getByRole('button', { name: 'Select line 1' }))
    await waitFor(() =>
      expect(store.get(touchEditingLineIdAtom)).toBe(lines[0].id)
    )
    fireEvent.click(view.getByRole('button', { name: 'Select line 2' }))
    expect(store.get(touchSelectedLineIdAtom)).toBe(lines[1].id)
    expect(store.get(touchEditingLineIdAtom)).toBeNull()
  }
)

test('collapsed children stay hidden when line chips and timer rows use the grid', () => {
  const store = createStore()
  store.set(
    docAtom,
    docMake([
      lineMake(0, 'Parent', { collapsed: true }),
      lineMake(1, 'Child'),
      lineMake(0, 'Next'),
    ])
  )
  const view = render(
    <Provider store={store}>
      <TEditor />
    </Provider>
  )
  const child = view.container.querySelector('[data-line-idx="1"]')!
  expect(child.getClientRects()).toHaveLength(0)
  fireEvent.click(view.getByRole('button', { name: 'Expand 1 hidden line' }))
  expect(child.getClientRects().length).toBeGreaterThan(0)
})

test('the new-line field transfers focus synchronously so initial keystrokes are not lost', () => {
  const store = createStore()
  store.set(docAtom, docMake([lineMake(0, 'Existing line')]))
  const view = render(
    <Provider store={store}>
      <TEditor />
    </Provider>
  )
  fireEvent.focus(view.getByRole('textbox', { name: 'New line' }))
  const content = view.container.querySelector(
    '[data-line-idx="1"] .cm-content'
  )!
  expect(document.activeElement).toBe(content)
})

test('clicking the empty right side focuses the line at its text end', () => {
  const store = createStore()
  store.set(docAtom, docMake([lineMake(0, 'A short line')]))
  const view = render(
    <Provider store={store}>
      <TEditor />
    </Provider>
  )
  const tail = view.container.querySelector('.ELine-tail')!
  expect(tail.getBoundingClientRect().width).toBeGreaterThan(100)
  fireEvent.mouseDown(tail, { button: 0 })
  expect(document.activeElement).toBe(
    view.container.querySelector('.cm-content')
  )
  expect(window.getSelection()?.anchorOffset).toBe('A short line'.length)
})

test('empty lines have full-width editors and the prompt stays after the document', async () => {
  const store = createStore()
  store.set(
    docAtom,
    docMake([lineMake(0, '# Heading'), lineMake(0, 'Text'), lineMake(0, '')])
  )
  const view = render(
    <Provider store={store}>
      <TEditor />
    </Provider>
  )
  const editors = Array.from(
    view.container.querySelectorAll<HTMLElement>('.cm-editor-container')
  )
  expect(editors[0].getBoundingClientRect().left).toBe(
    editors[1].getBoundingClientRect().left
  )
  expect(editors[2].getBoundingClientRect().left).toBe(
    editors[1].getBoundingClientRect().left
  )
  expect(editors[2].getBoundingClientRect().width).toBeGreaterThan(500)
  expect(view.container.querySelector('.cm-placeholder')).toBeNull()
  const blank = page.elementLocator(editors[2])
  await blank.click({ position: { x: 250, y: 10 } })
  expect(document.activeElement).toBe(editors[2].querySelector('.cm-content'))
  const prompt = view.getByRole('textbox', { name: 'New line' })
  expect(prompt.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    editors[2].getBoundingClientRect().bottom
  )
})

test.each([390, 1280])(
  'drag handles and action menus align with line text at every indent at %ipx',
  async (width) => {
    await page.viewport(width, 800)
    const store = createStore()
    store.set(
      docAtom,
      docMake([
        lineMake(0, 'Parent'),
        lineMake(1, 'Child'),
        lineMake(2, 'Grandchild'),
      ])
    )
    const view = render(
      <Provider store={store}>
        <TEditor />
      </Provider>
    )
    const rows = Array.from(
      view.container.querySelectorAll<HTMLElement>('.ELine')
    )
    const positions = rows.map((row) => ({
      drag: row.querySelector('.ELine-drag-handle')!.getBoundingClientRect(),
      actions: row.querySelector('.LineActions')!.getBoundingClientRect(),
      bullet: row.querySelector('.ELine-leading')!.getBoundingClientRect(),
      timestamp: row
        .querySelector('.ELine-gutter-text')!
        .getBoundingClientRect(),
      text: row.querySelector('.cm-line')!.getBoundingClientRect(),
      menuIcon: row.querySelector('.LineActions svg')!.getBoundingClientRect(),
      dragIcon: row
        .querySelector('.ELine-drag-handle svg')!
        .getBoundingClientRect(),
      top: row.getBoundingClientRect().top,
    }))
    for (const position of positions) {
      expect(position.drag.x).toBe(positions[0].drag.x)
      expect(position.actions.x).toBe(positions[0].actions.x)
      if (width >= 768) {
        expect(position.timestamp.right).toBeLessThanOrEqual(position.drag.left)
      } else {
        expect(position.timestamp.width).toBe(0)
      }
      expect(position.drag.right).toBeLessThanOrEqual(position.actions.left)
      expect(position.actions.right).toBeLessThanOrEqual(position.bullet.left)
      const center = position.text.top + position.text.height / 2
      for (const rect of [
        position.bullet,
        position.menuIcon,
        position.dragIcon,
      ]) {
        expect(rect.top + rect.height / 2).toBeCloseTo(center, 0)
      }
      expect(position.actions.top - position.top).toBe(
        positions[0].actions.top - positions[0].top
      )
    }
  }
)

test.each([1280, 1470])(
  'editor page is centered and capped at %ipx',
  async (width) => {
    await page.viewport(width, 900)
    const view = render(
      <Provider store={createStore()}>
        <div className="Editor" style={{ width: width - 320 }}>
          <TEditor />
        </div>
      </Provider>
    )
    const editor = view.container.querySelector<HTMLElement>('.TEditor-scroll')!
    const bounds = editor.getBoundingClientRect()
    const available = width - 320
    // The scroll area fills the editor so its scrollbar sits at the edge;
    // padding centers a 1040px column inside it.
    expect(bounds.width).toBe(available)
    expect(bounds.left).toBe(0)
    const inset = Math.max(48, (available - 1040) / 2 + 48)
    expect(parseFloat(getComputedStyle(editor).paddingLeft)).toBeCloseTo(inset)
    expect(parseFloat(getComputedStyle(editor).paddingRight)).toBeCloseTo(inset)
    expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth)
  }
)
