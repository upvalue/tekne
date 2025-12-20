// Custom command palette UI

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import { cn } from '@/lib/utils'
import { allCommands, searchCommands, getCommandByShortcut } from './registry'
import type { Command, CommandContext } from './types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  lineIdx: number | null
  view: EditorView | null
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  lineIdx,
  view,
}) => {
  const [searchMode, setSearchMode] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [pendingCommand, setPendingCommand] = useState<Command | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Build command context
  const context: CommandContext = useMemo(
    () => ({ lineIdx, view }),
    [lineIdx, view]
  )

  // Filter commands based on editor availability
  const availableCommands = useMemo(() => {
    if (view) {
      // Editor context available - show all commands
      return allCommands
    } else {
      // No editor context - only show global commands
      return allCommands.filter((cmd) => !cmd.requiresEditor)
    }
  }, [view])

  const filteredCommands = useMemo(() => {
    if (!searchMode || !query) return availableCommands
    return searchCommands(query).filter((cmd) => availableCommands.includes(cmd))
  }, [searchMode, query, availableCommands])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchMode(false)
      setQuery('')
      setActiveIndex(0)
      setPendingCommand(null)
    }
  }, [isOpen])

  // Keyboard navigation and shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow system shortcuts (copy/paste/etc) to pass through
      if (e.metaKey || e.ctrlKey) {
        return
      }

      // Prevent all other keyboard events from reaching the editor
      e.preventDefault()
      e.stopPropagation()

      // Arrow key navigation (works in all modes)
      if (e.key === 'ArrowDown') {
        if (pendingCommand?.subcommands) {
          setActiveIndex((i) => Math.min(i + 1, pendingCommand.subcommands!.length - 1))
        } else {
          setActiveIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
        }
        return
      }

      if (e.key === 'ArrowUp') {
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }

      // Enter to execute selected command/subcommand
      if (e.key === 'Enter') {
        if (pendingCommand?.subcommands) {
          const subcommand = pendingCommand.subcommands[activeIndex]
          if (subcommand) {
            subcommand.execute(context)
            onClose()
          }
        } else {
          const command = filteredCommands[activeIndex]
          if (command) {
            if (command.subcommands?.length) {
              // Enter subcommand mode
              setPendingCommand(command)
              setActiveIndex(0)
            } else {
              command.execute(context)
              onClose()
            }
          }
        }
        return
      }

      // Escape behavior depends on mode
      if (e.key === 'Escape') {
        if (pendingCommand) {
          // Exit subcommand mode back to main
          setPendingCommand(null)
          setActiveIndex(0)
        } else if (searchMode) {
          // Exit search mode back to shortcut mode
          setSearchMode(false)
          setQuery('')
          setActiveIndex(0)
        } else {
          // Close palette
          onClose()
        }
        return
      }

      // Single-key behavior depends on mode
      if (!e.altKey && e.key.length === 1) {
        const key = e.key.toLowerCase()

        if (pendingCommand?.subcommands) {
          // In subcommand mode: find and execute matching subcommand
          const subcommand = pendingCommand.subcommands.find(
            (sub) => sub.key.toLowerCase() === key
          )
          if (subcommand) {
            subcommand.execute(context)
            onClose()
          }
          return
        }

        if (!searchMode) {
          // Shortcut mode: execute commands or enter search/subcommand mode
          if (key === 's') {
            setSearchMode(true)
            setTimeout(() => inputRef.current?.focus(), 0)
            return
          }

          const command = getCommandByShortcut(e.key)
          if (command && availableCommands.includes(command)) {
            if (command.subcommands?.length) {
              // Enter subcommand mode
              setPendingCommand(command)
              setActiveIndex(0)
            } else {
              command.execute(context)
              onClose()
            }
          }
        }
        // In search mode, typing is handled by the input field
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [
    isOpen,
    searchMode,
    activeIndex,
    filteredCommands,
    availableCommands,
    pendingCommand,
    context,
    onClose,
  ])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 backdrop-blur-[3px]"
        onClick={onClose}
        style={{ backdropFilter: 'blur(3px)' }}
      />
      <div
        className="CommandPalette-container w-full max-w-xl relative z-10 p-2 rounded-lg shadow-xl text-white"
        style={{
          background:
            'radial-gradient(100% 100% at 50% 0, #0c0d0f 0, #07080a 150%)',
          boxShadow: 'inset 0 1px 0 0 hsla(0, 0%, 100%, 0.05)',
          border: '1px solid hsla(0, 0%, 100%, 0.08)',
        }}
      >
        {/* Subcommand mode header */}
        {pendingCommand && (
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
            <div className="text-xs text-gray-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-gray-700">
              {pendingCommand.displayShortcut || pendingCommand.shortcut}
            </div>
            <span className="text-gray-400">+</span>
            <span className="text-gray-400 text-sm">...</span>
            <span className="ml-auto text-xs text-gray-500">ESC to go back</span>
          </div>
        )}
        {searchMode && (
          <input
            ref={inputRef}
            type="text"
            className="w-full px-4 py-3 text-lg border-none outline-none bg-transparent"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
          />
        )}
        <div className="border-t border-gray-700 max-h-[50vh] overflow-y-auto">
          {/* Subcommand list */}
          {pendingCommand?.subcommands?.map((sub, idx) => (
            <div
              key={sub.key}
              className={cn(
                'p-2 cursor-pointer',
                idx === activeIndex && 'bg-zinc-800'
              )}
              onClick={() => {
                sub.execute(context)
                onClose()
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <div className="p-2 rounded-md flex items-center justify-between">
                <div>
                  <div className="font-medium">{sub.name}</div>
                  <div className="text-sm text-gray-500">{sub.description}</div>
                </div>
                <div className="text-xs text-gray-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-gray-700">
                  {sub.displayKey || sub.key.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
          {/* Main command list (when not in subcommand mode) */}
          {!pendingCommand && !searchMode && (
            <div
              className={cn(
                'p-2 cursor-pointer',
                activeIndex === -1 && 'bg-zinc-800'
              )}
              onClick={() => {
                setSearchMode(true)
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
            >
              <div className="p-2 rounded-md flex items-center justify-between">
                <div>
                  <div className="font-medium">Search commands</div>
                  <div className="text-sm text-gray-500">
                    Search for commands by name and description
                  </div>
                </div>
                <div className="text-xs text-gray-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-gray-700">
                  S
                </div>
              </div>
            </div>
          )}
          {!pendingCommand && filteredCommands.map((cmd, idx) => (
            <div
              key={cmd.id}
              className={cn(
                'p-2 cursor-pointer',
                idx === activeIndex && 'bg-zinc-800'
              )}
              onClick={() => {
                if (cmd.subcommands?.length) {
                  setPendingCommand(cmd)
                  setActiveIndex(0)
                } else {
                  cmd.execute(context)
                  onClose()
                }
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <div className="p-2 rounded-md flex items-center justify-between">
                <div>
                  <div className="font-medium">{cmd.name}</div>
                  <div className="text-sm text-gray-500">{cmd.description}</div>
                </div>
                {!searchMode && cmd.displayShortcut && (
                  <div className="flex items-center gap-1">
                    <div className="text-xs text-gray-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-gray-700">
                      {cmd.displayShortcut}
                    </div>
                    {cmd.subcommands?.length && (
                      <span className="text-xs text-gray-500">...</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
