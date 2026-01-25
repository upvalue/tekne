// Panel state atoms

import { atom } from 'jotai'

export type PanelTab = 'document' | 'search' | 'help' | 'devtools'

export const activePanelTabAtom = atom<PanelTab>('document')
