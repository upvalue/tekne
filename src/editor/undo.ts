import { atom, type Getter, type Setter } from 'jotai'
import { isEqual } from 'lodash-es'
import type { ZDoc } from '@/docs/schema'
import type { useStore } from 'jotai'
import {
  rawDocAtom,
  requestFocusLineAtom,
  focusedLineAtom,
  focusedPosAtom,
} from './doc-atoms'
import { ensureUniqueLineTimeCreateds } from '@/docs/line-identity'

export type UndoEntry = {
  doc: ZDoc
  focusedLine: number
  focusedPos: number
}

export const UNDO_STACK_LIMIT = 1000

/**
 * Consecutive text-only edits to the same line within this window collapse
 * into one undo entry, so undoing a typed run takes one keypress instead
 * of one per character.
 */
export const COALESCE_WINDOW_MS = 1000

export const undoStackAtom = atom<UndoEntry[]>([])
export const redoStackAtom = atom<UndoEntry[]>([])

/**
 * Guard flag: when true, writes to docAtom skip undo capture.
 * Set during undo/redo restores to prevent the restore itself
 * from being recorded as a new undo entry.
 */
export const suppressUndoCaptureAtom = atom<boolean>(false)

/**
 * Last capture, for coalescing typed runs. Null means the next
 * capture starts a fresh entry regardless of timing.
 */
const lastCaptureAtom = atom<{ time: number; lineIdx: number } | null>(null)

/**
 * Returns the changed line index when prev -> next is a text-only edit to
 * exactly one line (only mdContent/timeUpdated differ), otherwise null.
 * Structural changes (insert, delete, reorder, indent, data changes) never
 * qualify, so they always get their own undo entry.
 */
const textOnlyChangedLine = (prev: ZDoc, next: ZDoc): number | null => {
  if (prev.children.length !== next.children.length) return null
  let changed: number | null = null
  for (let i = 0; i < prev.children.length; i++) {
    const a = prev.children[i]
    const b = next.children[i]
    if (a === b) continue
    if (changed !== null) return null
    if (
      !isEqual(
        { ...a, mdContent: '', timeUpdated: '' },
        { ...b, mdContent: '', timeUpdated: '' }
      )
    ) {
      return null
    }
    changed = i
  }
  return changed
}

export const captureUndoEntry = (
  get: Getter,
  set: Setter,
  prevDoc: ZDoc,
  nextDoc: ZDoc
) => {
  if (prevDoc === nextDoc) return

  const now = Date.now()
  const changedLine = textOnlyChangedLine(prevDoc, nextDoc)
  const last = get(lastCaptureAtom)

  set(redoStackAtom, [])
  set(
    lastCaptureAtom,
    changedLine !== null ? { time: now, lineIdx: changedLine } : null
  )

  const continuesTypedRun =
    changedLine !== null &&
    last !== null &&
    last.lineIdx === changedLine &&
    now - last.time < COALESCE_WINDOW_MS
  if (continuesTypedRun) return

  const focusedLine = get(focusedLineAtom) ?? 0
  const focusedPos = get(focusedPosAtom)
  set(undoStackAtom, (prev) => {
    const next = [...prev, { doc: prevDoc, focusedLine, focusedPos }]
    return next.length > UNDO_STACK_LIMIT ? next.slice(-UNDO_STACK_LIMIT) : next
  })
}

const snapshotCurrent = (store: ReturnType<typeof useStore>): UndoEntry => ({
  doc: store.get(rawDocAtom),
  focusedLine: store.get(focusedLineAtom) ?? 0,
  focusedPos: store.get(focusedPosAtom),
})

const restoreEntry = (store: ReturnType<typeof useStore>, entry: UndoEntry) => {
  // Restore without capturing undo
  store.set(suppressUndoCaptureAtom, true)
  store.set(rawDocAtom, ensureUniqueLineTimeCreateds(entry.doc))
  store.set(suppressUndoCaptureAtom, false)
  store.set(lastCaptureAtom, null)

  // Request focus on the line and column that were focused at snapshot time
  const targetLine = Math.min(entry.focusedLine, entry.doc.children.length - 1)
  const lineLength = entry.doc.children[targetLine]?.mdContent.length ?? 0
  store.set(requestFocusLineAtom, {
    lineIdx: targetLine,
    pos: Math.min(entry.focusedPos, lineLength),
  })
}

export const undo = (store: ReturnType<typeof useStore>) => {
  const undoStack = store.get(undoStackAtom)
  if (undoStack.length === 0) return

  const entry = undoStack[undoStack.length - 1]

  // Push current state to redo
  store.set(redoStackAtom, (prev) => [...prev, snapshotCurrent(store)])

  // Pop undo stack
  store.set(undoStackAtom, undoStack.slice(0, -1))

  restoreEntry(store, entry)
}

export const redo = (store: ReturnType<typeof useStore>) => {
  const redoStack = store.get(redoStackAtom)
  if (redoStack.length === 0) return

  const entry = redoStack[redoStack.length - 1]

  // Push current state to undo
  store.set(undoStackAtom, (prev) => [...prev, snapshotCurrent(store)])

  // Pop redo stack
  store.set(redoStackAtom, redoStack.slice(0, -1))

  restoreEntry(store, entry)
}

export const resetUndoHistory = (store: ReturnType<typeof useStore>) => {
  store.set(undoStackAtom, [])
  store.set(redoStackAtom, [])
  store.set(lastCaptureAtom, null)
}
