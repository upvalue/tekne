// keys.ts -- Key bindings

import { isMac, modSymbol } from './platform'

export interface Keybinding {
  /**
   * The key combination (e.g., 'meta+k', 'ctrl+shift+p')
   * Note that codemirror and react key codes are different
   *
   */
  key: string
  /** Descriptive name for the keybinding (e.g., 'document-search') */
  name: string
  /** Human-readable description of what the keybinding does */
  description: string
  /** Display string for the key combination (e.g., '⌘ K' on Mac, 'Ctrl K' on others) */
  displayKey: string
  /** Type of keybinding - 'react' for react-hotkeys-hook, 'codemirror' for CodeMirror keymap */
  type: 'react' | 'codemirror'
}

/** Modifier key name for use in prose/tutorial text (e.g., 'Cmd' on Mac, 'Ctrl' on others) */
export const modName = isMac ? 'Cmd' : 'Ctrl'

export const keybindings = {
  documentSearch: {
    key: 'meta+o',
    name: 'document-search',
    description: 'Open a document',
    displayKey: `${modSymbol} O`,
    type: 'react' as const,
  },
  searchPanel: {
    key: 'meta+/',
    name: 'search-panel',
    description: 'Open search panel',
    displayKey: `${modSymbol} /`,
    type: 'react' as const,
  },
  commandPalette: {
    key: 'meta+k',
    name: 'command-palette',
    description: 'Open command palette',
    displayKey: `${modSymbol} K`,
    type: 'react' as const,
  },
  toggleCollapse: {
    key: 'Mod-.',
    name: 'toggle-collapse',
    description: 'Toggle line collapse',
    displayKey: `${modSymbol} .`,
    type: 'codemirror' as const,
  },
  goToLine: {
    key: 'ctrl+g',
    name: 'go-to-line',
    description: 'Go to line number',
    displayKey: 'Ctrl G',
    type: 'react' as const,
  },
} satisfies Record<string, Keybinding>

/** Get all keybindings as an array */
export const getAllKeybindings = (): Keybinding[] => {
  return Object.values(keybindings)
}

/** Get a specific keybinding by name */
export const getKeybinding = (name: keyof typeof keybindings): Keybinding => {
  return keybindings[name]
}
