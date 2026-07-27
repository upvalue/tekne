import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'jotai'
import { docMake, lineMake, type ZDoc } from '@/docs/schema'
import {
  docAtom,
  focusedLineAtom,
  focusedPosAtom,
  requestFocusLineAtom,
} from './state'
import {
  COALESCE_WINDOW_MS,
  UNDO_STACK_LIMIT,
  redo,
  redoStackAtom,
  resetUndoHistory,
  undo,
  undoStackAtom,
} from './undo'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const testDoc = (...contents: string[]): ZDoc =>
  docMake(
    contents.map((mdContent, index) =>
      lineMake(0, mdContent, {
        timeCreated: iso(index),
        timeUpdated: iso(index),
      })
    )
  )

const makeStore = (doc: ZDoc) => {
  const store = createStore()
  store.set(docAtom, doc)
  resetUndoHistory(store)
  return store
}

const setLineContent = (
  store: ReturnType<typeof createStore>,
  lineIdx: number,
  mdContent: string
) => {
  store.set(docAtom, (draft) => {
    draft.children[lineIdx].mdContent = mdContent
  })
}

const contents = (store: ReturnType<typeof createStore>) =>
  store.get(docAtom).children.map((line) => line.mdContent)

describe('undo capture', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('captures an entry when the doc changes', () => {
    const store = makeStore(testDoc('hello'))
    setLineContent(store, 0, 'hello!')
    expect(store.get(undoStackAtom)).toHaveLength(1)
  })

  it('coalesces consecutive text edits to the same line', () => {
    const store = makeStore(testDoc(''))
    for (const text of ['h', 'he', 'hel', 'hell', 'hello']) {
      setLineContent(store, 0, text)
      vi.advanceTimersByTime(100)
    }
    expect(store.get(undoStackAtom)).toHaveLength(1)

    undo(store)
    expect(contents(store)).toEqual([''])
    redo(store)
    expect(contents(store)).toEqual(['hello'])
  })

  it('starts a new entry after a typing pause', () => {
    const store = makeStore(testDoc(''))
    setLineContent(store, 0, 'first')
    vi.advanceTimersByTime(COALESCE_WINDOW_MS + 1)
    setLineContent(store, 0, 'first second')
    expect(store.get(undoStackAtom)).toHaveLength(2)

    undo(store)
    expect(contents(store)).toEqual(['first'])
    undo(store)
    expect(contents(store)).toEqual([''])
  })

  it('does not coalesce edits on different lines', () => {
    const store = makeStore(testDoc('a', 'b'))
    setLineContent(store, 0, 'a1')
    setLineContent(store, 1, 'b1')
    expect(store.get(undoStackAtom)).toHaveLength(2)
  })

  it('does not coalesce structural changes', () => {
    const store = makeStore(testDoc(''))
    setLineContent(store, 0, 'text')
    store.set(docAtom, (draft) => {
      draft.children.push(lineMake(0, '', { timeCreated: iso(500) }))
    })
    expect(store.get(undoStackAtom)).toHaveLength(2)

    undo(store)
    expect(contents(store)).toEqual(['text'])
  })

  it('does not coalesce across an undo boundary', () => {
    const store = makeStore(testDoc(''))
    setLineContent(store, 0, 'first')
    undo(store)
    setLineContent(store, 0, 'second')
    expect(store.get(undoStackAtom)).toHaveLength(1)
    undo(store)
    expect(contents(store)).toEqual([''])
  })

  it('clears the redo stack on a new edit', () => {
    const store = makeStore(testDoc(''))
    setLineContent(store, 0, 'first')
    undo(store)
    expect(store.get(redoStackAtom)).toHaveLength(1)
    setLineContent(store, 0, 'other')
    expect(store.get(redoStackAtom)).toHaveLength(0)
  })

  it('caps the undo stack at UNDO_STACK_LIMIT', () => {
    const store = makeStore(testDoc(''))
    for (let i = 0; i < UNDO_STACK_LIMIT + 10; i++) {
      setLineContent(store, 0, `edit ${i}`)
      vi.advanceTimersByTime(COALESCE_WINDOW_MS + 1)
    }
    expect(store.get(undoStackAtom)).toHaveLength(UNDO_STACK_LIMIT)
  })

  it('restores focus to the line and column at snapshot time', () => {
    const store = makeStore(testDoc('hello'))
    store.set(focusedLineAtom, 0)
    store.set(focusedPosAtom, 2)
    setLineContent(store, 0, 'heLLLllo')

    undo(store)
    expect(store.get(requestFocusLineAtom)).toEqual({ lineIdx: 0, pos: 2 })
  })

  it('clamps restored focus to the restored doc', () => {
    const store = makeStore(testDoc('ab'))
    store.set(focusedLineAtom, 0)
    store.set(focusedPosAtom, 10)
    setLineContent(store, 0, 'ab plus more text')

    undo(store)
    expect(store.get(requestFocusLineAtom)).toEqual({ lineIdx: 0, pos: 2 })
  })

  it('undo and redo are no-ops on empty stacks', () => {
    const store = makeStore(testDoc('hello'))
    undo(store)
    redo(store)
    expect(contents(store)).toEqual(['hello'])
  })
})
