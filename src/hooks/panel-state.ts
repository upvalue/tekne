// Panel state atoms.
//
// These are app-level UI state, not document state. The editor routes each
// create their own Jotai store for the document, so anything here must be
// read and written through one shared store — otherwise a command registered
// outside a route's <Provider> (e.g. the command palette's "toggle panel")
// writes to a store the mounted panel never reads. The hooks below pin every
// consumer to `uiStore`; use them instead of useAtom on the raw atoms.

import { atom, getDefaultStore, useAtom, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

/** The single store backing app-level UI atoms, usable outside React too. */
export const uiStore = getDefaultStore()

export type PanelTab =
  | 'document'
  | 'search'
  | 'tools'
  | 'agent'
  | 'help'
  | 'devtools'

export const activePanelTabAtom = atom<PanelTab>('document')

/** Minimum viewport width (px) at which the panel shows side-by-side instead of as an overlay. Matches Tailwind `lg:`. */
export const PANEL_BREAKPOINT = 1024

/** Whether the sidebar panel is visible. Defaults to true on desktop (≥1024px), false on smaller screens. */
const getDefaultPanelVisible = () =>
  typeof window !== 'undefined' &&
  window.matchMedia(`(min-width: ${PANEL_BREAKPOINT}px)`).matches

export const panelVisibleAtom = atom<boolean>(getDefaultPanelVisible())

/** Narrowest the desktop panel can be dragged (px). */
export const PANEL_MIN_WIDTH = 320

/** Desktop panel width in px, persisted across sessions. Defaults to the pre-resize 40% split. */
const getDefaultPanelWidth = () =>
  typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.4) : 480

export const panelWidthAtom = atomWithStorage<number>(
  'tekne.panelWidth',
  getDefaultPanelWidth(),
  undefined,
  { getOnInit: true }
)

/**
 * Tag (without '#') that tag management in the Tools tab should highlight,
 * e.g. after clicking a tag in the editor. Cleared once handled.
 */
export const tagManagerTargetAtom = atom<string | null>(null)

export const usePanelVisible = () =>
  useAtom(panelVisibleAtom, { store: uiStore })
export const usePanelWidth = () => useAtom(panelWidthAtom, { store: uiStore })
export const useSetPanelVisible = () =>
  useSetAtom(panelVisibleAtom, { store: uiStore })
export const useActivePanelTab = () =>
  useAtom(activePanelTabAtom, { store: uiStore })
export const useSetActivePanelTab = () =>
  useSetAtom(activePanelTabAtom, { store: uiStore })
export const useTagManagerTarget = () =>
  useAtom(tagManagerTargetAtom, { store: uiStore })
export const useSetTagManagerTarget = () =>
  useSetAtom(tagManagerTargetAtom, { store: uiStore })

/** Show the panel on the given tab; safe to call from outside React. */
export const openPanelTab = (tab: PanelTab) => {
  uiStore.set(activePanelTabAtom, tab)
  uiStore.set(panelVisibleAtom, true)
}
