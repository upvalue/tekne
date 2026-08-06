// Command definitions. Importing this module registers every command with the
// registry in @/editor/command-registry; the app root does that import.

import { registerCommands, type Command } from '@/editor/command-registry'
import { emitCodemirrorEvent } from '@/editor/line-editor/cm-events'
import { deleteLine } from '@/editor/line-ops'
import { formatDate, getDocTitle } from '@/lib/utils'
import { trpcClient } from '@/trpc/client'
import { openPanelTab, panelVisibleAtom, uiStore } from '@/hooks/panel-state'
import { setDisplayModeOverride } from '@/hooks/display-mode'
import { appPath, stripAppBasePath } from '@/lib/app-path'

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
  window.location.href = appPath(`/n/${encodeURIComponent(title)}`)
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
  {
    id: 'line-edit',
    name: 'Line edit',
    description: 'Line editing shortcuts',
    shortcut: 'l',
    displayShortcut: 'L',
    keywords: ['line', 'edit', 'delete', 'remove'],
    requiresEditor: true,
    subcommands: [
      {
        key: 'd',
        displayKey: 'D',
        name: 'Delete line',
        description: 'Delete the entire current line',
        execute: ({ lineIdx, store }) => {
          if (lineIdx === null) return
          deleteLine(store, lineIdx)
        },
      },
    ],
    execute: () => {
      // Parent command doesn't execute directly when subcommands exist
    },
  },
]

// ============================================================================
// Navigation Commands
// ============================================================================

const navigationCommands: Command[] = [
  {
    id: 'search',
    name: 'Search',
    description: 'Search across all documents',
    shortcut: '/',
    displayShortcut: '/',
    keywords: ['search', 'find', 'query'],
    requiresEditor: false,
    execute: () => {
      openPanelTab('search')
    },
  },
  {
    id: 'agent',
    name: 'Agent',
    description: 'Propose document edits with the agent',
    shortcut: 'a',
    displayShortcut: 'A',
    keywords: ['agent', 'ai', 'edit', 'assistant', 'llm', 'propose'],
    requiresEditor: false,
    execute: () => {
      openPanelTab('agent')
    },
  },
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
      {
        key: 'r',
        displayKey: 'R',
        name: 'Restart tutorial',
        description: 'Restart the tutorial from the beginning',
        execute: async () => {
          try {
            try {
              await trpcClient.doc.deleteDoc.mutate({ name: 'Tutorial' })
            } catch (e: unknown) {
              // Ignore not found error - OK if tutorial doesn't exist
              if (!(e instanceof Error) || !e.message.includes('not found')) {
                throw e
              }
            }
            if (stripAppBasePath(window.location.pathname) === '/n/Tutorial') {
              window.location.reload()
            } else {
              navigateTo('Tutorial')
            }
          } catch (error) {
            console.error('Failed to restart tutorial:', error)
          }
        },
      },
    ],
    execute: () => {
      // Parent command doesn't execute directly when subcommands exist
    },
  },
  {
    id: 'delete-doc',
    name: 'Delete document',
    description: 'Delete the current document',
    shortcut: 'x',
    displayShortcut: 'X',
    keywords: ['delete', 'remove', 'destroy'],
    requiresEditor: false,
    execute: async () => {
      const title = getDocTitle()
      if (!title) return
      if (!confirm(`Delete "${decodeURIComponent(title)}"?`)) return
      try {
        await trpcClient.doc.deleteDoc.mutate({
          name: decodeURIComponent(title),
        })
        window.location.href = appPath('/')
      } catch (error) {
        console.error('Failed to delete document:', error)
      }
    },
  },
  {
    id: 'new-from-template',
    name: 'New from template',
    description: 'Create a new document from a template',
    shortcut: 'n',
    displayShortcut: 'N',
    keywords: ['template', 'new', 'create'],
    requiresEditor: false,
    execute: () => {
      window.dispatchEvent(new CustomEvent('tekne:new-from-template'))
    },
  },
  {
    id: 'toggle-panel',
    name: 'Toggle panel',
    description: 'Show or hide the sidebar panel',
    shortcut: 'b',
    displayShortcut: 'B',
    keywords: ['panel', 'sidebar', 'toggle', 'hide', 'show'],
    requiresEditor: false,
    execute: () => {
      uiStore.set(panelVisibleAtom, (v) => !v)
    },
  },
  {
    id: 'display-mode',
    name: 'Display mode',
    description: 'Switch between desktop and touch mode',
    keywords: ['display', 'touch', 'mobile', 'desktop', 'mode'],
    requiresEditor: false,
    subcommands: [
      {
        key: 'a',
        displayKey: 'A',
        name: 'Auto',
        description: 'Pick from screen size and pointer type',
        execute: () => setDisplayModeOverride('auto'),
      },
      {
        key: 'd',
        displayKey: 'D',
        name: 'Desktop',
        description: 'Always use the keyboard-first editor',
        execute: () => setDisplayModeOverride('desktop'),
      },
      {
        key: 't',
        displayKey: 'T',
        name: 'Touch',
        description: 'Always use touch controls',
        execute: () => setDisplayModeOverride('touch'),
      },
    ],
    execute: () => {
      // Parent command doesn't execute directly when subcommands exist
    },
  },
]

registerCommands([...editorCommands, ...navigationCommands])
