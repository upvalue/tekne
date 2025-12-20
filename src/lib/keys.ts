// keys.ts -- Key bindings

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
  /** Display string for the key combination (e.g., '⌘ K') */
  displayKey: string
  /** Type of keybinding - 'react' for react-hotkeys-hook, 'codemirror' for CodeMirror keymap */
  type: 'react' | 'codemirror'
}

export const keybindings = {
  documentSearch: {
    key: 'meta+/',
    name: 'document-search',
    description: 'Open a document',
    displayKey: '⌘ /',
    type: 'react' as const,
  },
  commandPalette: {
    key: 'meta+k',
    name: 'command-palette',
    description: 'Open command palette',
    displayKey: '⌘ K',
    type: 'react' as const,
  },
  toggleCollapse: {
    key: 'Cmd-.',
    name: 'toggle-collapse',
    description: 'Toggle line collapse',
    displayKey: '⌘ .',
    type: 'codemirror' as const,
  },
} as const satisfies Record<string, Keybinding>

/** Get all keybindings as an array */
export const getAllKeybindings = (): Keybinding[] => {
  return Object.values(keybindings)
}

/** Get a specific keybinding by name */
export const getKeybinding = (name: keyof typeof keybindings): Keybinding => {
  return keybindings[name]
}
