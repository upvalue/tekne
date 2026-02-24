// Panel state atoms

import { atom } from 'jotai'

export type PanelTab = 'document' | 'search' | 'help' | 'devtools'

export const activePanelTabAtom = atom<PanelTab>('document')

/** Minimum viewport width (px) at which the panel shows side-by-side instead of as an overlay. Matches Tailwind `lg:`. */
export const PANEL_BREAKPOINT = 1024

/** Whether the sidebar panel is visible. Defaults to true on desktop (≥1024px), false on smaller screens. */
const getDefaultPanelVisible = () =>
  typeof window !== 'undefined' && window.matchMedia(`(min-width: ${PANEL_BREAKPOINT}px)`).matches

export const panelVisibleAtom = atom<boolean>(getDefaultPanelVisible())
