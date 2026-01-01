// Command registry - all command definitions and utility functions

import type { Command } from './types'
import { emitCodemirrorEvent } from '@/editor/line-editor/cm-events'
import { formatDate, getDocTitle } from '@/lib/utils'

/** Check if a string is a valid YYYY-MM-DD date */
const isDateString = (str: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(str)

/** Parse YYYY-MM-DD to Date */
const parseDate = (str: string): Date | null => {
  if (!isDateString(str)) return null
  const [year, month, day] = str.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Navigate to a document */
const navigateTo = (title: string) => {
  window.location.href = `/n/${encodeURIComponent(title)}`
}

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
    name: 'Timer',
    description: 'Timer commands',
    shortcut: 't',
    displayShortcut: 'T',
    keywords: ['timer', 'time', 'track', 'clock'],
    requiresEditor: true,
    subcommands: [
      {
        key: 't',
        displayKey: 'T',
        name: 'Toggle timer',
        description: 'Add or remove a timer on the current line',
        execute: ({ lineIdx }) => {
          if (lineIdx === null) return
          emitCodemirrorEvent('lineTimerToggle', { lineIdx })
        },
      },
      {
        key: '1',
        displayKey: '1',
        name: 'Stopwatch',
        description: 'Open timer in stopwatch mode (counts up)',
        execute: ({ lineIdx }) => {
          if (lineIdx === null) return
          emitCodemirrorEvent('lineTimerOpen', { lineIdx, mode: 'stopwatch' })
        },
      },
      {
        key: '2',
        displayKey: '2',
        name: 'Countdown',
        description: 'Open timer in countdown mode',
        execute: ({ lineIdx }) => {
          if (lineIdx === null) return
          emitCodemirrorEvent('lineTimerOpen', { lineIdx, mode: 'countdown' })
        },
      },
      {
        key: '3',
        displayKey: '3',
        name: 'Manual',
        description: 'Open timer in manual entry mode',
        execute: ({ lineIdx }) => {
          if (lineIdx === null) return
          emitCodemirrorEvent('lineTimerOpen', { lineIdx, mode: 'manual' })
        },
      },
    ],
    execute: () => {
      // Parent command doesn't execute directly when subcommands exist
    },
  },
  {
    id: 'task',
    name: 'Toggle task',
    description: 'Add or remove a checkbox on the current line',
    shortcut: 'c',
    displayShortcut: 'C',
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
    id: 'go',
    name: 'Go to',
    description: 'Navigation commands',
    shortcut: 'g',
    displayShortcut: 'G',
    keywords: ['go', 'navigate', 'open'],
    requiresEditor: false,
    subcommands: [
      {
        key: 'h',
        displayKey: 'H',
        name: 'Previous day',
        description: 'Navigate to the previous daily note',
        execute: () => {
          const title = getDocTitle()
          if (!title) return
          const date = parseDate(title)
          if (!date) return
          date.setDate(date.getDate() - 1)
          navigateTo(formatDate(date))
        },
      },
      {
        key: 't',
        displayKey: 'T',
        name: "Today's note",
        description: "Navigate to today's daily note",
        execute: () => {
          navigateTo(formatDate(new Date()))
        },
      },
      {
        key: 'l',
        displayKey: 'L',
        name: 'Next day',
        description: 'Navigate to the next daily note',
        execute: () => {
          const title = getDocTitle()
          if (!title) return
          const date = parseDate(title)
          if (!date) return
          date.setDate(date.getDate() + 1)
          navigateTo(formatDate(date))
        },
      },
    ],
    execute: () => {
      // Parent command doesn't execute directly when subcommands exist
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
