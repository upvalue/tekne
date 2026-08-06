import { describe, test, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import { docMake, lineMake, type ZDoc } from '@/docs/schema'
import { docAtom, globalTimerAtom, timerDialogRequestAtom } from './state'
import { resetUndoHistory, undo } from './undo'
import {
  canMoveBlockDown,
  canMoveBlockUp,
  cycleTaskStatus,
  deleteLine,
  indentLine,
  insertLineAbove,
  insertLineBelow,
  moveBlockDown,
  moveBlockUp,
  openTimerDialog,
  outdentLine,
  setLineColor,
  toggleCollapse,
  togglePin,
  toggleTask,
  toggleTimer,
} from './line-ops'

type Store = ReturnType<typeof createStore>

/** A doc from (content, indent) pairs. */
const doc = (...lines: [string, number][]): ZDoc =>
  docMake(lines.map(([mdContent, indent]) => lineMake(indent, mdContent)))

const contents = (store: Store) =>
  store.get(docAtom).children.map((l) => [l.mdContent, l.indent])

const makeStore = (d: ZDoc) => {
  const store = createStore()
  store.set(docAtom, d)
  resetUndoHistory(store)
  return store
}

describe('indent and outdent', () => {
  test('indent respects the one-past-predecessor guard', () => {
    const store = makeStore(doc(['a', 0], ['b', 0], ['c', 1]))
    expect(indentLine(store, 0)).toBe(false)
    expect(indentLine(store, 1)).toBe(true)
    // c (idx 2) is at 1, b now at 1, allowed to go to 2
    expect(indentLine(store, 2)).toBe(true)
    // and no further: 3 > b.indent(1) + 1
    expect(indentLine(store, 2)).toBe(false)
    expect(contents(store)).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ])
  })

  test('outdent stops at the margin', () => {
    const store = makeStore(doc(['a', 0], ['b', 1]))
    expect(outdentLine(store, 1)).toBe(true)
    expect(outdentLine(store, 1)).toBe(false)
  })
})

describe('insert', () => {
  test('insertLineBelow lands after the line, same indent', () => {
    const store = makeStore(doc(['a', 0], ['b', 1]))
    const idx = insertLineBelow(store, 0)
    expect(idx).toBe(1)
    expect(contents(store)).toEqual([
      ['a', 0],
      ['', 0],
      ['b', 1],
    ])
  })

  test('insertLineBelow a collapsed block lands after its subtree', () => {
    const store = makeStore(doc(['a', 0], ['a1', 1], ['a2', 1], ['b', 0]))
    store.set(docAtom, (draft) => {
      draft.children[0].collapsed = true
    })
    const idx = insertLineBelow(store, 0)
    expect(idx).toBe(3)
    expect(contents(store)[3]).toEqual(['', 0])
  })

  test('insertLineAbove takes the displaced line indent', () => {
    const store = makeStore(doc(['a', 0], ['b', 2]))
    const idx = insertLineAbove(store, 1)
    expect(idx).toBe(1)
    expect(contents(store)).toEqual([
      ['a', 0],
      ['', 2],
      ['b', 2],
    ])
  })
})

describe('deleteLine', () => {
  test('removes the line', () => {
    const store = makeStore(doc(['a', 0], ['b', 0]))
    deleteLine(store, 1)
    expect(contents(store)).toEqual([['a', 0]])
  })

  test('clears the last remaining line instead of removing it', () => {
    const store = makeStore(doc(['only', 0]))
    deleteLine(store, 0)
    expect(contents(store)).toEqual([['', 0]])
  })

  test('is undoable', () => {
    const store = makeStore(doc(['a', 0], ['b', 0]))
    deleteLine(store, 1)
    undo(store)
    expect(contents(store)).toEqual([
      ['a', 0],
      ['b', 0],
    ])
  })
})

describe('toggleCollapse', () => {
  test('refuses on a childless line', () => {
    const store = makeStore(doc(['a', 0], ['b', 0]))
    expect(toggleCollapse(store, 0)).toBe(false)
  })

  test('round-trips', () => {
    const store = makeStore(doc(['a', 0], ['a1', 1]))
    expect(toggleCollapse(store, 0)).toBe(true)
    expect(store.get(docAtom).children[0].collapsed).toBe(true)
    expect(toggleCollapse(store, 0)).toBe(true)
    expect(store.get(docAtom).children[0].collapsed).toBeUndefined()
  })
})

describe('line data toggles', () => {
  let store: Store
  beforeEach(() => {
    store = makeStore(doc(['a', 0]))
  })

  test('pin round-trips', () => {
    togglePin(store, 0)
    expect(store.get(docAtom).children[0].datumPinnedAt).toBeDefined()
    togglePin(store, 0)
    expect(store.get(docAtom).children[0].datumPinnedAt).toBeUndefined()
  })

  test('task toggle adds unset, removal drops the datum', () => {
    toggleTask(store, 0)
    expect(store.get(docAtom).children[0].datumTaskStatus).toBe('unset')
    toggleTask(store, 0)
    expect(store.get(docAtom).children[0].datumTaskStatus).toBeUndefined()
  })

  test('task status cycles unset -> complete -> incomplete -> unset', () => {
    toggleTask(store, 0)
    cycleTaskStatus(store, 0)
    expect(store.get(docAtom).children[0].datumTaskStatus).toBe('complete')
    cycleTaskStatus(store, 0)
    expect(store.get(docAtom).children[0].datumTaskStatus).toBe('incomplete')
    cycleTaskStatus(store, 0)
    expect(store.get(docAtom).children[0].datumTaskStatus).toBe('unset')
  })

  test('color set and clear', () => {
    setLineColor(store, 0, 'blue')
    expect(store.get(docAtom).children[0].color).toBe('blue')
    setLineColor(store, 0, null)
    expect(store.get(docAtom).children[0].color).toBeUndefined()
  })
})

describe('toggleTimer', () => {
  test('adds a zero timer to a bare line', () => {
    const store = makeStore(doc(['a', 0]))
    toggleTimer(store, 0)
    expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(0)
  })

  test('declined confirm keeps a timer with data', () => {
    const store = makeStore(doc(['a', 0]))
    store.set(docAtom, (draft) => {
      draft.children[0].datumTimeSeconds = 90
    })
    toggleTimer(store, 0, () => false)
    expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(90)
    toggleTimer(store, 0, () => true)
    expect(store.get(docAtom).children[0].datumTimeSeconds).toBeUndefined()
  })

  test('removing the timer of the running line cancels the global timer', () => {
    const store = makeStore(doc(['a', 0]))
    store.set(docAtom, (draft) => {
      draft.children[0].datumTimeSeconds = 0
    })
    const line = store.get(docAtom).children[0]
    store.set(globalTimerAtom, (prev) => ({
      ...prev,
      isActive: true,
      lineTimeCreated: line.timeCreated,
      startTime: 12345,
    }))
    toggleTimer(store, 0, () => true)
    expect(store.get(globalTimerAtom).isActive).toBe(false)
    expect(store.get(docAtom).children[0].datumTimeSeconds).toBeUndefined()
  })
})

describe('openTimerDialog', () => {
  test('ensures a timer datum and requests the dialog', () => {
    const store = makeStore(doc(['a', 0]))
    openTimerDialog(store, 0, 'countdown')
    expect(store.get(docAtom).children[0].datumTimeSeconds).toBe(0)
    expect(store.get(timerDialogRequestAtom)).toEqual({
      lineIdx: 0,
      mode: 'countdown',
    })
  })
})

describe('block moves', () => {
  const treeDoc = () =>
    doc(['a', 0], ['a1', 1], ['a2', 1], ['b', 0], ['b1', 1], ['c', 0])

  test('predicates respect sibling boundaries', () => {
    const d = treeDoc()
    expect(canMoveBlockUp(d.children, 0)).toBe(false)
    expect(canMoveBlockUp(d.children, 3)).toBe(true)
    expect(canMoveBlockDown(d.children, 5)).toBe(false)
    expect(canMoveBlockDown(d.children, 0)).toBe(true)
    // first child has no previous sibling; its parent doesn't count
    expect(canMoveBlockUp(d.children, 1)).toBe(false)
    expect(canMoveBlockDown(d.children, 1)).toBe(true)
  })

  test('moveBlockUp carries the subtree', () => {
    const store = makeStore(treeDoc())
    expect(moveBlockUp(store, 3)).toBe(true)
    expect(contents(store)).toEqual([
      ['b', 0],
      ['b1', 1],
      ['a', 0],
      ['a1', 1],
      ['a2', 1],
      ['c', 0],
    ])
  })

  test('moveBlockDown from a mid-block line moves the whole block', () => {
    const store = makeStore(treeDoc())
    // lineIdx 4 is b1, inside block b; the block containing b1 is just b1
    // (its own subtree), which has no same-indent sibling below
    expect(moveBlockDown(store, 4)).toBe(false)
    // block a (via its subtree line a1's parent start) moves below b
    expect(moveBlockDown(store, 0)).toBe(true)
    expect(contents(store)).toEqual([
      ['b', 0],
      ['b1', 1],
      ['a', 0],
      ['a1', 1],
      ['a2', 1],
      ['c', 0],
    ])
  })

  test('moves are undoable', () => {
    const store = makeStore(treeDoc())
    moveBlockUp(store, 3)
    undo(store)
    expect(contents(store)).toEqual([
      ['a', 0],
      ['a1', 1],
      ['a2', 1],
      ['b', 0],
      ['b1', 1],
      ['c', 0],
    ])
  })
})
