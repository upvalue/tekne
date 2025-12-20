// Command system types

import type { EditorView } from '@codemirror/view'

export interface CommandContext {
  /** Currently focused line index, null if no line focused */
  lineIdx: number | null

  /** EditorView of focused line, null if no editor context */
  view: EditorView | null
}

export interface Command {
  /** Unique identifier (e.g., 'toggle-pin') */
  id: string

  /** Display name for UI (e.g., 'Toggle pin') */
  name: string

  /** Longer description shown in command palette */
  description: string

  /** Single-key shortcut (e.g., 'p' for pin) */
  shortcut?: string

  /** Display version of shortcut (e.g., 'P') */
  displayShortcut?: string

  /** Keywords for search matching */
  keywords?: string[]

  /** Whether this command requires editor context (EditorView) */
  requiresEditor: boolean

  /** Execute the command */
  execute: (context: CommandContext) => void | Promise<void>
}
