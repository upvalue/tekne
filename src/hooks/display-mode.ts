// Display mode: desktop (keyboard-first, the classic editor) vs touch
// (tap-to-select lines plus the bottom touch bar). Resolved from viewport
// width and pointer type, with a persisted per-device override. Like the
// panel atoms, everything lives on uiStore so commands registered outside a
// route's <Provider> read and write the same state the UI renders.
import { atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useEffect } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import { uiStore } from './panel-state'

export type DisplayMode = 'desktop' | 'touch'
export type DisplayModeOverride = 'auto' | DisplayMode

/** Below this viewport width (px), auto mode always chooses touch. */
export const TOUCH_BREAKPOINT = 768

export const resolveDisplayMode = (
  override: DisplayModeOverride,
  isNarrow: boolean,
  isCoarse: boolean
): DisplayMode => {
  if (override !== 'auto') return override
  return isNarrow || isCoarse ? 'touch' : 'desktop'
}

/**
 * The user's explicit mode choice. localStorage rather than a server flag
 * on purpose: this is a per-device preference, and syncing a phone's choice
 * to a desktop would be wrong.
 */
export const displayModeOverrideAtom = atomWithStorage<DisplayModeOverride>(
  'tekne.displayMode',
  'auto',
  undefined,
  { getOnInit: true }
)

/** The resolved mode, mirrored into an atom so non-React code can read it. */
export const displayModeAtom = atom<DisplayMode>('desktop')

export const useDisplayModeOverride = () =>
  useAtom(displayModeOverrideAtom, { store: uiStore })

/**
 * Resolve the mode from media queries and keep displayModeAtom in sync.
 * Call once near the top of the tree (EditorShell); everything else reads
 * through useDisplayMode.
 */
export const useSyncDisplayMode = (): DisplayMode => {
  const [override] = useDisplayModeOverride()
  const isNarrow = useMediaQuery(`(max-width: ${TOUCH_BREAKPOINT - 1}px)`)
  const isCoarse = useMediaQuery('(pointer: coarse)')
  const mode = resolveDisplayMode(override, isNarrow, isCoarse)

  useEffect(() => {
    uiStore.set(displayModeAtom, mode)
  }, [mode])

  return mode
}

export const useDisplayMode = (): DisplayMode =>
  useAtomValue(displayModeAtom, { store: uiStore })

/** Current resolved mode; safe to call from outside React. */
export const getDisplayMode = (): DisplayMode => uiStore.get(displayModeAtom)

/** Set the persisted override; safe to call from outside React. */
export const setDisplayModeOverride = (override: DisplayModeOverride) =>
  uiStore.set(displayModeOverrideAtom, override)
