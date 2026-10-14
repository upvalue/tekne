// App-level UI uses uiStore so commands and document-scoped Providers share state.
// Use these hooks instead of reading the raw atoms through a route store.

import { atom, getDefaultStore, useAtom, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

/** The single store backing app-level UI atoms, usable outside React too. */
export const uiStore = getDefaultStore()

export type PanelTab = 'document' | 'search' | 'tools' | 'devtools'

export const helpOpenAtom = atom(false)
export const useHelpOpen = () => useAtom(helpOpenAtom, { store: uiStore })
export const openHelp = () => uiStore.set(helpOpenAtom, true)

export const activePanelTabAtom = atom<PanelTab>('document')

/** Minimum viewport width (px) at which the panel shows side-by-side instead of as an overlay. Matches Tailwind `lg:`. */
export const PANEL_BREAKPOINT = 1024

const wideQuery =
  typeof window !== 'undefined'
    ? window.matchMedia?.(`(min-width: ${PANEL_BREAKPOINT}px)`)
    : undefined

/** Whether the viewport is at or past PANEL_BREAKPOINT; tracks resizes and rotation. */
export const isWideViewportAtom = atom<boolean>(wideQuery?.matches ?? false)

wideQuery?.addEventListener('change', (e) => {
  uiStore.set(isWideViewportAtom, e.matches)
})

/**
 * The user's explicit show/hide choice, or null when they haven't made one.
 * Kept separate from the viewport default so a resize across the breakpoint
 * still updates visibility until the user overrides it.
 */
const panelUserChoiceAtom = atom<boolean | null>(null)

/** Whether the sidebar panel is visible. Defaults to true on desktop (≥1024px), false on smaller screens. */
export const panelVisibleAtom = atom(
  (get) => get(panelUserChoiceAtom) ?? get(isWideViewportAtom),
  (get, set, update: boolean | ((prev: boolean) => boolean)) => {
    const prev = get(panelUserChoiceAtom) ?? get(isWideViewportAtom)
    set(
      panelUserChoiceAtom,
      typeof update === 'function' ? update(prev) : update
    )
  }
)

/** Narrowest the desktop panel can be dragged (px). */
export const PANEL_MIN_WIDTH = 240

/** Desktop panel width in px, persisted across sessions. Defaults to a compact 22% split, capped at 300px. */
const getDefaultPanelWidth = () =>
  typeof window !== 'undefined'
    ? Math.min(
        300,
        Math.max(PANEL_MIN_WIDTH, Math.round(window.innerWidth * 0.22))
      )
    : 280

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

/** Set by openSearch and cleared once the search input has taken focus. */
export const searchFocusRequestedAtom = atom(false)
export const useSearchFocusRequested = () =>
  useAtom(searchFocusRequestedAtom, { store: uiStore })

/** Show the search tab and focus its query input. */
export const openSearch = () => {
  uiStore.set(searchFocusRequestedAtom, true)
  openPanelTab('search')
}

export const activeToolTabAtom = atom<'tasks' | 'tags' | 'timers'>('tasks')
export const useActiveToolTab = () =>
  useAtom(activeToolTabAtom, { store: uiStore })
export const openToolTab = (tab: 'tasks' | 'tags' | 'timers') => {
  uiStore.set(activeToolTabAtom, tab)
  openPanelTab('tools')
}
