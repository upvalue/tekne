// line-ops.ts -- Store-level line operations.
//
// Every operation takes (store, lineIdx, ...) and writes through docAtom, so
// it works with no CodeMirror view mounted and no DOM at all. The CodeMirror
// keymap (line-editor/line-operations.ts), the document-level event handlers
// (useDocumentLineEvents.ts) and the touch controls are all thin adapters
// over this file. Keep @codemirror imports out of here; that is what makes
// these directly testable and reusable.
import type { useStore } from 'jotai'
import { lineMake, type ZLine } from '@/docs/schema'
import {
  docAtom,
  globalTimerAtom,
  requestFocusLineAtom,
  timerDialogRequestAtom,
  type TimerMode,
} from './state'
import {
  canIndentLine,
  indentLine as indentLineDoc,
  outdentLine as outdentLineDoc,
  removeLine,
} from './line-editor/line-mutations'
import { getLineId, getOutlineIds, getOutlineRange } from './outline-selection'
import { moveSelectedLines } from './line-reorder'
import { cancelTimer } from './timer/timer-controller'

type EditorStore = ReturnType<typeof useStore>

/** Tab. Returns false when the indent guard forbids it. */
export const indentLine = (store: EditorStore, lineIdx: number): boolean => {
  const doc = store.get(docAtom)
  if (!canIndentLine(doc, lineIdx)) return false
  store.set(docAtom, indentLineDoc(doc, lineIdx))
  return true
}

/** Shift-Tab. Returns false when the line is already at the left margin. */
export const outdentLine = (store: EditorStore, lineIdx: number): boolean => {
  const next = outdentLineDoc(store.get(docAtom), lineIdx)
  if (next === null) return false
  store.set(docAtom, next)
  return true
}

/** Delete an entire line, moving focus to the previous line.
 *  The last remaining line is cleared instead of removed. Callers that
 *  manage their own selection (the touch bar) pass requestFocus: false. */
export const deleteLine = (
  store: EditorStore,
  lineIdx: number,
  { requestFocus = true }: { requestFocus?: boolean } = {}
): void => {
  const { doc, focus } = removeLine(store.get(docAtom), lineIdx)
  if (focus && requestFocus) {
    store.set(requestFocusLineAtom, focus)
  }
  store.set(docAtom, doc)
}

/** Insert an empty line above, at the displaced line's indent. Returns its index. */
export const insertLineAbove = (
  store: EditorStore,
  lineIdx: number
): number => {
  store.set(docAtom, (draft) => {
    draft.children.splice(lineIdx, 0, lineMake(draft.children[lineIdx].indent))
  })
  return lineIdx
}

/**
 * Insert an empty line below, at the same indent. A collapsed block hides its
 * children, so "below" means after the whole subtree there. Returns the new
 * line's index.
 */
export const insertLineBelow = (
  store: EditorStore,
  lineIdx: number
): number => {
  const doc = store.get(docAtom)
  const line = doc.children[lineIdx]
  const at = line.collapsed
    ? getOutlineRange(doc.children, lineIdx).end
    : lineIdx + 1
  store.set(docAtom, (draft) => {
    draft.children.splice(at, 0, lineMake(line.indent))
  })
  return at
}

/** Collapse or expand a line's subtree. Returns false on childless lines. */
export const toggleCollapse = (
  store: EditorStore,
  lineIdx: number
): boolean => {
  const doc = store.get(docAtom)
  const nextLine = doc.children[lineIdx + 1]
  if (!nextLine || nextLine.indent <= doc.children[lineIdx].indent) {
    return false
  }
  store.set(docAtom, (draft) => {
    if (draft.children[lineIdx].collapsed) {
      delete draft.children[lineIdx].collapsed
    } else {
      draft.children[lineIdx].collapsed = true
    }
  })
  return true
}

export const togglePin = (store: EditorStore, lineIdx: number): void => {
  store.set(docAtom, (draft) => {
    const line = draft.children[lineIdx]
    if (!line) return
    if (line.datumPinnedAt) {
      delete line.datumPinnedAt
    } else {
      line.datumPinnedAt = new Date().toISOString()
    }
  })
}

/** Add or remove the line's checkbox. */
export const toggleTask = (store: EditorStore, lineIdx: number): void => {
  store.set(docAtom, (draft) => {
    const line = draft.children[lineIdx]
    if (!line) return
    if (line.datumTaskStatus) {
      delete line.datumTaskStatus
    } else {
      line.datumTaskStatus = 'unset'
    }
  })
}

/** Checkbox tap: unset -> complete -> incomplete -> unset. */
export const cycleTaskStatus = (store: EditorStore, lineIdx: number): void => {
  store.set(docAtom, (draft) => {
    const line = draft.children[lineIdx]
    if (!line) return
    const cycle = {
      unset: 'complete',
      complete: 'incomplete',
      incomplete: 'unset',
    } as const
    line.datumTaskStatus = cycle[line.datumTaskStatus || 'unset']
  })
}

export const setLineColor = (
  store: EditorStore,
  lineIdx: number,
  color: ZLine['color'] | null
): void => {
  store.set(docAtom, (draft) => {
    const line = draft.children[lineIdx]
    if (!line) return
    if (color === null) {
      delete line.color
    } else {
      line.color = color
    }
  })
}

/**
 * Add a timer datum, or remove an existing one. Removal confirms when the
 * timer has recorded data and discards (not saves) a timer running on this
 * line. The prompt and the timer transition happen before the state update —
 * never inside the Immer recipe.
 */
export const toggleTimer = (
  store: EditorStore,
  lineIdx: number,
  confirmFn: (message: string) => boolean = (message) => confirm(message)
): void => {
  const line = store.get(docAtom).children[lineIdx]
  if (!line) return

  if (line.datumTimeSeconds === undefined) {
    store.set(docAtom, (draft) => {
      draft.children[lineIdx].datumTimeSeconds = 0
    })
    return
  }

  if (
    line.datumTimeSeconds > 0 &&
    !confirmFn('Timer has data, do you want to remove it?')
  ) {
    return
  }
  if (store.get(globalTimerAtom).lineTimeCreated === line.timeCreated) {
    cancelTimer(store)
  }
  store.set(docAtom, (draft) => {
    delete draft.children[lineIdx].datumTimeSeconds
  })
}

/** Ensure the line has a timer datum and request the timer dialog on it. */
export const openTimerDialog = (
  store: EditorStore,
  lineIdx: number,
  mode: TimerMode
): void => {
  store.set(docAtom, (draft) => {
    if (draft.children[lineIdx]?.datumTimeSeconds === undefined) {
      draft.children[lineIdx].datumTimeSeconds = 0
    }
  })
  store.set(timerDialogRequestAtom, { lineIdx, mode })
}

/**
 * The previous and next sibling blocks of the block containing lineIdx:
 * nearest same-indent lines not separated by a shallower one. -1 when the
 * block is first (prev) or last (next) among its siblings.
 */
const blockSiblings = (lines: ZLine[], lineIdx: number) => {
  const range = getOutlineRange(lines, lineIdx)
  const indent = lines[range.start].indent

  let prev = -1
  for (let j = range.start - 1; j >= 0; j--) {
    if (lines[j].indent < indent) break
    if (lines[j].indent === indent) {
      prev = j
      break
    }
  }

  const next =
    range.end < lines.length && lines[range.end].indent === indent
      ? range.end
      : -1

  return { range, prev, next }
}

export const canMoveBlockUp = (lines: ZLine[], lineIdx: number): boolean =>
  blockSiblings(lines, lineIdx).prev !== -1

export const canMoveBlockDown = (lines: ZLine[], lineIdx: number): boolean =>
  blockSiblings(lines, lineIdx).next !== -1

const moveBlock = (
  store: EditorStore,
  lineIdx: number,
  direction: 'up' | 'down'
): boolean => {
  const doc = store.get(docAtom)
  const lines = doc.children
  const { range, prev, next } = blockSiblings(lines, lineIdx)
  const targetIdx = direction === 'up' ? prev : next
  if (targetIdx === -1) return false

  const touchedLineId = getLineId(lines[range.start])
  const { lines: nextLines, moved } = moveSelectedLines({
    lines,
    selectedLineIds: getOutlineIds(lines, range.start),
    targetId: getLineId(lines[targetIdx]),
    edge: direction === 'up' ? 'before' : 'after',
    touchedLineId,
    now: new Date().toISOString(),
  })
  if (!moved) return false

  store.set(docAtom, { ...doc, children: nextLines })
  return true
}

/** Swap the line's block with its previous sibling block. */
export const moveBlockUp = (store: EditorStore, lineIdx: number): boolean =>
  moveBlock(store, lineIdx, 'up')

/** Swap the line's block with its next sibling block. */
export const moveBlockDown = (store: EditorStore, lineIdx: number): boolean =>
  moveBlock(store, lineIdx, 'down')
