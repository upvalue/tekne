// Navigation and global commands

import type { Command } from '../types'

// These will be imported and used once we wire up navigation
// For now, placeholder implementations
export const navigationCommands: Command[] = [
  {
    id: 'open-today',
    name: "Open today's daily note",
    description: "Navigate to today's daily note",
    shortcut: undefined, // No single-key shortcut for now
    keywords: ['daily', 'note', 'today', 'journal'],
    requiresEditor: false,
    execute: () => {
      // TODO: Implement navigation to today's note
      console.log('Navigate to today')
    },
  },
]
