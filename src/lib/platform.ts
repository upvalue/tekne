// platform.ts -- Platform and input-modality detection

/**
 * iOS or iPadOS. Modern iPadOS reports `navigator.platform` as 'MacIntel',
 * so a real Mac is distinguished by having no touch points.
 */
export const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Desktop macOS only; iPhone/iPad are isIOS, not isMac. */
export const isMac =
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) && !isIOS

/**
 * Any Apple platform. Hardware keyboards use Cmd as the primary modifier on
 * all of them, so key matching and the ⌘ symbol key off this, not isMac.
 */
export const isApple = isMac || isIOS

/** The primary pointer is a finger (phone or tablet). */
export const isTouchPrimary =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)')?.matches ??
    navigator.maxTouchPoints > 0)

/** Modifier symbol for display: ⌘ on Apple platforms, Ctrl elsewhere */
export const modSymbol = isApple ? '⌘' : 'Ctrl'
