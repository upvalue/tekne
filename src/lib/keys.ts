// keys.ts -- Key bindings

import { isApple, modSymbol } from './platform'

export interface Keybinding {
  /**
   * The combo, lowercase and '+'-separated with the key itself last. 'mod' is
   * the platform's primary modifier -- Cmd on Mac, Ctrl elsewhere -- while
   * 'ctrl' means the literal Control key everywhere.
   */
  key: string
  /** Descriptive name for the keybinding (e.g., 'document-search') */
  name: string
  /** Human-readable description of what the keybinding does */
  description: string
  /**
   * Which system installs the binding. Each one reads `key` through the
   * matching adapter below, so behavior and the Help panel share a source.
   */
  type: 'global' | 'codemirror' | 'kbar'
}

/** Modifier key name for use in prose/tutorial text (e.g., 'Cmd' on Mac, 'Ctrl' on others) */
export const modName = isApple ? 'Cmd' : 'Ctrl'

export const keybindings = {
  documentSearch: {
    key: 'mod+o',
    name: 'document-search',
    description: 'Open a document',
    type: 'kbar' as const,
  },
  searchPanel: {
    key: 'mod+/',
    name: 'search-panel',
    description: 'Open search panel',
    type: 'global' as const,
  },
  togglePanel: {
    key: 'mod+\\',
    name: 'toggle-panel',
    description: 'Show or hide the panel',
    type: 'global' as const,
  },
  commandPalette: {
    key: 'mod+k',
    name: 'command-palette',
    description: 'Open command palette',
    type: 'global' as const,
  },
  toggleCollapse: {
    key: 'mod+.',
    name: 'toggle-collapse',
    description: 'Toggle line collapse',
    type: 'codemirror' as const,
  },
  goToLine: {
    key: 'ctrl+g',
    name: 'go-to-line',
    description: 'Go to line number',
    type: 'global' as const,
  },
  deleteLine: {
    key: 'mod+shift+k',
    name: 'delete-line',
    description: 'Delete the entire current line',
    type: 'codemirror' as const,
  },
} satisfies Record<string, Keybinding>

export type KeybindingName = keyof typeof keybindings

const MOD = 'mod'

const comboParts = (key: string) => key.split('+')

/** Display string for a combo, e.g. 'mod+shift+k' -> '⌘ Shift K' */
export const displayKey = (binding: Keybinding): string =>
  comboParts(binding.key)
    .map((part) => {
      switch (part) {
        case MOD:
          return modSymbol
        case 'ctrl':
          return 'Ctrl'
        case 'shift':
          return 'Shift'
        case 'alt':
          return isApple ? '⌥' : 'Alt'
        default:
          return part.length === 1 ? part.toUpperCase() : part
      }
    })
    .join(' ')

/** CodeMirror keymap form, e.g. 'mod+shift+k' -> 'Mod-Shift-k' */
export const codeMirrorKey = (name: KeybindingName): string =>
  comboParts(keybindings[name].key)
    .map((part) => {
      switch (part) {
        case MOD:
          return 'Mod'
        case 'ctrl':
          return 'Ctrl'
        case 'shift':
          return 'Shift'
        case 'alt':
          return 'Alt'
        default:
          return part
      }
    })
    .join('-')

/** kbar shortcut form, e.g. 'mod+o' -> '$mod+o' */
export const kbarShortcut = (name: KeybindingName): string =>
  comboParts(keybindings[name].key)
    .map((part) => (part === MOD ? '$mod' : part))
    .join('+')

/**
 * Whether a keydown event is this combo. Modifiers have to match exactly, so
 * Cmd+Shift+/ no longer fires the Cmd+/ binding.
 */
export const matchesKeybinding = (
  binding: Keybinding,
  e: KeyboardEvent
): boolean => {
  const parts = comboParts(binding.key)
  const finalKey = parts[parts.length - 1]
  const mods = new Set(parts.slice(0, -1))
  const usesMod = mods.has(MOD)

  return (
    e.key.toLowerCase() === finalKey &&
    e.metaKey === (usesMod && isApple) &&
    e.ctrlKey === (mods.has('ctrl') || (usesMod && !isApple)) &&
    e.shiftKey === mods.has('shift') &&
    e.altKey === mods.has('alt')
  )
}

/** Get all keybindings as an array */
export const getAllKeybindings = (): Keybinding[] => {
  return Object.values(keybindings)
}
