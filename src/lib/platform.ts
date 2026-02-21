// platform.ts -- Platform detection for cross-platform keybindings

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)

/** Modifier symbol for display: ⌘ on Mac, Ctrl on other platforms */
export const modSymbol = isMac ? '⌘' : 'Ctrl'
