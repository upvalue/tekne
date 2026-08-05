// Base document and focus atoms, split out of state.ts so undo.ts can import
// them without a cycle (state.ts's docAtom depends on undo capture).

import { atom } from 'jotai'
import { withImmer } from 'jotai-immer'
import { lineMake, type ZDoc } from '@/docs/schema'

export const rawDocAtom = withImmer(
  atom<ZDoc>({
    type: 'doc',
    children: [lineMake(0, '')],
  } as ZDoc)
)

export const focusedLineAtom = atom<number | null>(null)

/**
 * Cursor column within the focused line, synced from CodeMirror selection
 * changes. Captured into undo entries so restores can return the cursor
 * to where it was, not just the line.
 */
export const focusedPosAtom = atom<number>(0)

export const requestFocusLineAtom = atom({
  lineIdx: -1,
  pos: 0,
})
