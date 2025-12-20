// Command registry - all command definitions and utility functions

import type { Command } from './types'
import { emitCodemirrorEvent } from '@/editor/line-editor/cm-events'

// ============================================================================
// Editor Commands
// ============================================================================

const editorCommands: Command[] = [
  {
    id: 'pin',
    name: 'Toggle pin',
    description: 'Pin or unpin the current line',
    shortcut: 'p',
    displayShortcut: 'P',
    keywords: ['pin', 'bookmark', 'mark'],
    requiresEditor: true,
    execute: ({ lineIdx }) => {
      if (lineIdx === null) {
        console.warn('No line focused - cannot toggle pin')
        return
      }
      emitCodemirrorEvent('linePinToggle', { lineIdx })
    },
  },
  {
    id: 'timer',
    name: 'Toggle timer',
    description: 'Add or remove a timer on the current line',
    shortcut: 't',
    displayShortcut: 'T',
    keywords: ['timer', 'time', 'track', 'clock'],
    requiresEditor: true,
    execute: ({ lineIdx }) => {
      if (lineIdx === null) return
      emitCodemirrorEvent('lineTimerToggle', { lineIdx })
    },
  },
  {
    id: 'task',
    name: 'Toggle task',
    description: 'Add or remove a checkbox on the current line',
    shortcut: 'x',
    displayShortcut: 'X',
    keywords: ['task', 'todo', 'checkbox', 'check'],
    requiresEditor: true,
    execute: ({ lineIdx }) => {
      if (lineIdx === null) return
      emitCodemirrorEvent('lineTaskToggle', { lineIdx })
    },
  },
  {
    id: 'collapse',
    name: 'Toggle collapse',
    description: 'Collapse or expand the current line and its children',
    shortcut: '.',
    displayShortcut: '.',
    keywords: ['collapse', 'expand', 'fold', 'hide'],
    requiresEditor: true,
    execute: ({ lineIdx }) => {
      if (lineIdx === null) return
      emitCodemirrorEvent('lineCollapseToggle', { lineIdx })
    },
  },
  {
    id: 'date',
    name: 'Insert date',
    description: "Insert today's date in YYYY-MM-DD format",
    shortcut: 'd',
    displayShortcut: 'D',
    keywords: ['date', 'today', 'insert'],
    requiresEditor: true,
    execute: ({ view }) => {
      if (!view) return

      const date = new Date().toISOString().split('T')[0]
      const pos = view.state.selection.main.head

      view.dispatch({
        changes: {
          from: pos,
          to: pos,
          insert: date,
        },
      })
    },
  },
]

// ============================================================================
// Navigation Commands
// ============================================================================

const navigationCommands: Command[] = [
  {
    id: 'open-today',
    name: "Open today's daily note",
    description: "Navigate to today's daily note",
    shortcut: undefined,
    keywords: ['daily', 'note', 'today', 'journal'],
    requiresEditor: false,
    execute: () => {
      // TODO: Implement navigation to today's note
      console.log('Navigate to today')
    },
  },
]

// ============================================================================
// Registry
// ============================================================================

/** All available commands */
export const allCommands: Command[] = [...editorCommands, ...navigationCommands]

/** Find a command by its shortcut key */
export const getCommandByShortcut = (key: string): Command | undefined => {
  return allCommands.find((cmd) => cmd.shortcut === key)
}

/** Search commands by query string */
export const searchCommands = (query: string): Command[] => {
  const q = query.toLowerCase()
  return allCommands.filter((cmd) => {
    const matchesName = cmd.name.toLowerCase().includes(q)
    const matchesDescription = cmd.description.toLowerCase().includes(q)
    const matchesKeywords = cmd.keywords?.some((k) =>
      k.toLowerCase().includes(q)
    )
    return matchesName || matchesDescription || matchesKeywords
  })
}
