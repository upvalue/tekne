// Command registry - utility functions for working with commands

import type { Command } from './types'
import { editorCommands } from './definitions/editor'
import { navigationCommands } from './definitions/navigation'

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
