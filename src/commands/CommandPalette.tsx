// Custom command palette UI

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import { cn } from '@/lib/utils'
import { allCommands, searchCommands, getCommandByShortcut } from './registry'
import type { Command, CommandContext } from './types'

/** Shared component for rendering a command/subcommand item */
export const CommandItem: React.FC<{
  name: string
  description: string
  shortcut?: string
  hasSubcommands?: boolean
  isActive?: boolean
  showShortcut?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}> = ({
  name,
  description,
  shortcut,
  hasSubcommands,
  isActive,
  showShortcut = true,
  onClick,
  onMouseEnter,
}) => (
  <div
    className={cn('p-2 cursor-pointer', isActive && 'bg-zinc-800')}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
  >
    <div className="p-2 rounded-md flex items-center justify-between">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
      {showShortcut && shortcut && (
        <div className="flex items-center gap-1">
          <div className="text-xs text-gray-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-gray-700">
            {shortcut}
          </div>
          {hasSubcommands && <span className="text-xs text-gray-500">...</span>}
        </div>
      )}
    </div>
  </div>
)

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
      // In main mode: index 0 = Search, index 1+ = commands
      if (e.key === 'ArrowDown') {
        if (pendingCommand?.subcommands) {
          setActiveIndex((i) => Math.min(i + 1, pendingCommand.subcommands!.length - 1))
        } else if (searchMode) {
          setActiveIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
        } else {
          // +1 for the "Search commands" item at index 0
          setActiveIndex((i) => Math.min(i + 1, filteredCommands.length))
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
        } else if (searchMode) {
          const command = filteredCommands[activeIndex]
          if (command) {
            command.execute(context)
            onClose()
          }
        } else {
          // Index 0 = Search commands
          if (activeIndex === 0) {
            setSearchMode(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          } else {
            const command = filteredCommands[activeIndex - 1]
            if (command) {
              if (command.subcommands?.length) {
                setPendingCommand(command)
                setActiveIndex(0)
              } else {
                command.execute(context)
                onClose()
              }
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
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Subcommand list */}
          {pendingCommand?.subcommands?.map((sub, idx) => (
            <CommandItem
              key={sub.key}
              name={sub.name}
              description={sub.description}
              shortcut={sub.displayKey || sub.key.toUpperCase()}
              isActive={idx === activeIndex}
              onClick={() => {
                sub.execute(context)
                onClose()
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            />
          ))}
          {/* Search commands option (index 0 in main mode) */}
          {!pendingCommand && !searchMode && (
            <CommandItem
              name="Search commands"
              description="Search for commands by name and description"
              shortcut="S"
              isActive={activeIndex === 0}
              onClick={() => {
                setSearchMode(true)
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
              onMouseEnter={() => setActiveIndex(0)}
            />
          )}
          {/* Command list (index 1+ in main mode, index 0+ in search mode) */}
          {!pendingCommand && filteredCommands.map((cmd, idx) => {
            const itemIndex = searchMode ? idx : idx + 1
            return (
              <CommandItem
                key={cmd.id}
                name={cmd.name}
                description={cmd.description}
                shortcut={cmd.displayShortcut}
                hasSubcommands={!!cmd.subcommands?.length}
                isActive={itemIndex === activeIndex}
                showShortcut={!searchMode}
                onClick={() => {
                  if (cmd.subcommands?.length) {
                    setPendingCommand(cmd)
                    setActiveIndex(0)
                  } else {
                    cmd.execute(context)
                    onClose()
                  }
                }}
                onMouseEnter={() => setActiveIndex(itemIndex)}
              />
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
