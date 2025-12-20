// Editor-related commands

import { emitCodemirrorEvent } from '@/editor/line-editor/cm-events'
import type { Command } from '../types'

export const editorCommands: Command[] = [
  {
    id: 'toggle-pin',
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
    id: 'toggle-timer',
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
    id: 'toggle-task',
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
    id: 'toggle-collapse',
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
    id: 'insert-date',
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
