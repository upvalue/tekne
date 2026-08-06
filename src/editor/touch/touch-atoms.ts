// Touch-mode selection state. Lives on the per-document route store (unlike
// display-mode, which is app-level): the selected line belongs to a document.
//
// Selection is kept as a line id (timeCreated) rather than an index so it
// survives inserts, deletes and block moves; the index view is derived.
import { atom } from 'jotai'
import { docAtom } from '../state'
import { findLineIndexById, type LineId } from '../outline-selection'

export const touchSelectedLineIdAtom = atom<LineId | null>(null)

/**
 * The line being text-edited in touch mode, if any. While a line is here its
 * CodeMirror may take real focus (raising the software keyboard); for every
 * other line a focus request is downgraded to a selection update.
 */
export const touchEditingLineIdAtom = atom<LineId | null>(null)

/** The selected line's index, or null when nothing valid is selected. */
export const touchSelectedLineIdxAtom = atom((get) => {
  const id = get(touchSelectedLineIdAtom)
  if (id === null) return null
  const idx = findLineIndexById(get(docAtom).children, id)
  return idx === -1 ? null : idx
})
