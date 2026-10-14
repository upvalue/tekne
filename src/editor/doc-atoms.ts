// Base document and focus atoms, split out of state.ts so undo.ts can import
// them without a cycle (state.ts's docAtom depends on undo capture).

import { atom } from 'jotai'
import { docMake, lineMake, type ZDoc } from '@/docs/schema'

export const rawDocAtom = atom<ZDoc>(docMake([lineMake(0, '')]))

export const focusedLineAtom = atom<number | null>(null)

/** Cursor column captured with undo entries and restored with the focused line. */
export const focusedPosAtom = atom<number>(0)

export const requestFocusLineAtom = atom({
  lineIdx: -1,
  pos: 0,
})
