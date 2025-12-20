// Command system types

import type { EditorView } from '@codemirror/view'

export interface CommandContext {
  /** Currently focused line index, null if no line focused */
  lineIdx: number | null

  /** EditorView of focused line, null if no editor context */
  view: EditorView | null
}

export interface SubCommand {
  /** Second keystroke (e.g., 't', '1', '2', '3') */
  key: string

  /** Display version of key */
  displayKey?: string

  /** Display name for UI */
  name: string

  /** Description shown in command palette */
  description: string

  /** Execute the subcommand */
  execute: (context: CommandContext) => void | Promise<void>
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

  /** Subcommands for multi-key sequences (e.g., 't t' for toggle timer) */
  subcommands?: SubCommand[]

  /** Execute the command (not called if subcommands exist) */
  execute: (context: CommandContext) => void | Promise<void>
}
