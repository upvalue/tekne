import { atom } from 'jotai'
import type { ZDoc } from '@/docs/schema'
import type { useStore } from 'jotai'
import { rawDocAtom, requestFocusLineAtom, focusedLineAtom } from './state'

export type UndoEntry = {
  doc: ZDoc
  focusedLine: number
}

export const UNDO_STACK_LIMIT = 1000

export const undoStackAtom = atom<UndoEntry[]>([])
export const redoStackAtom = atom<UndoEntry[]>([])

/**
 * Guard flag: when true, writes to docAtom skip undo capture.
 * Set during undo/redo restores to prevent the restore itself
 * from being recorded as a new undo entry.
 */
export const suppressUndoCaptureAtom = atom<boolean>(false)

export const undo = (store: ReturnType<typeof useStore>) => {
  const undoStack = store.get(undoStackAtom)
  if (undoStack.length === 0) return

  const entry = undoStack[undoStack.length - 1]
  const currentDoc = store.get(rawDocAtom)
  const currentFocusedLine = store.get(focusedLineAtom) ?? 0

  // Push current state to redo
  store.set(redoStackAtom, (prev) => [
    ...prev,
    { doc: currentDoc, focusedLine: currentFocusedLine },
  ])

  // Pop undo stack
  store.set(undoStackAtom, undoStack.slice(0, -1))

  // Restore without capturing undo
  store.set(suppressUndoCaptureAtom, true)
  store.set(rawDocAtom, entry.doc)
  store.set(suppressUndoCaptureAtom, false)

  // Request focus on the line that was focused at snapshot time
  const targetLine = Math.min(entry.focusedLine, entry.doc.children.length - 1)
  store.set(requestFocusLineAtom, {
    lineIdx: targetLine,
    pos: entry.doc.children[targetLine]?.mdContent.length ?? 0,
  })
}

export const redo = (store: ReturnType<typeof useStore>) => {
  const redoStack = store.get(redoStackAtom)
  if (redoStack.length === 0) return

  const entry = redoStack[redoStack.length - 1]
  const currentDoc = store.get(rawDocAtom)
  const currentFocusedLine = store.get(focusedLineAtom) ?? 0

  // Push current state to undo
  store.set(undoStackAtom, (prev) => [
    ...prev,
    { doc: currentDoc, focusedLine: currentFocusedLine },
  ])

  // Pop redo stack
  store.set(redoStackAtom, redoStack.slice(0, -1))

  // Restore without capturing undo
  store.set(suppressUndoCaptureAtom, true)
  store.set(rawDocAtom, entry.doc)
  store.set(suppressUndoCaptureAtom, false)

  // Request focus
  const targetLine = Math.min(entry.focusedLine, entry.doc.children.length - 1)
  store.set(requestFocusLineAtom, {
    lineIdx: targetLine,
    pos: entry.doc.children[targetLine]?.mdContent.length ?? 0,
  })
}

export const resetUndoHistory = (store: ReturnType<typeof useStore>) => {
  store.set(undoStackAtom, [])
  store.set(redoStackAtom, [])
}
