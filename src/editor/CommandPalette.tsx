// Custom command palette UI

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import { useStore } from 'jotai'
import { cn } from '@/lib/utils'
import {
  getAllCommands,
  searchCommands,
  getCommandByShortcut,
} from './command-registry'
import type { Command, CommandContext } from './command-registry'

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

/**
 * The palette is always in exactly one of three modes; each mode derives one
 * flat item list, which both keyboard navigation and rendering share — so
 * there is no per-mode index arithmetic.
 */
type PaletteMode =
  | { kind: 'main' }
  | { kind: 'search' }
  | { kind: 'sub'; command: Command }

type PaletteItem = {
  itemKey: string
  name: string
  description: string
  shortcut?: string
  hasSubcommands: boolean
  showShortcut: boolean
  run: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  lineIdx,
  view,
}) => {
  const [mode, setMode] = useState<PaletteMode>({ kind: 'main' })
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const store = useStore()

  // Build command context
  const context: CommandContext = useMemo(
    () => ({ lineIdx, view, store }),
    [lineIdx, view, store]
  )

  // Filter commands based on editor availability
  const availableCommands = useMemo(() => {
    if (view) {
      // Editor context available - show all commands
      return getAllCommands()
    } else {
      // No editor context - only show global commands
      return getAllCommands().filter((cmd) => !cmd.requiresEditor)
    }
  }, [view])

  const enterSearchMode = React.useCallback(() => {
    setMode({ kind: 'search' })
    setQuery('')
    setActiveIndex(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const runCommand = React.useCallback(
    (command: Command) => {
      if (command.subcommands?.length) {
        setMode({ kind: 'sub', command })
        setActiveIndex(0)
      } else {
        command.execute(context)
        onClose()
      }
    },
    [context, onClose]
  )

  const items: PaletteItem[] = useMemo(() => {
    switch (mode.kind) {
      case 'sub':
        return (mode.command.subcommands ?? []).map((sub) => ({
          itemKey: sub.key,
          name: sub.name,
          description: sub.description,
          shortcut: sub.displayKey || sub.key.toUpperCase(),
          hasSubcommands: false,
          showShortcut: true,
          run: () => {
            sub.execute(context)
            onClose()
          },
        }))
      case 'search': {
        const filtered = query
          ? searchCommands(query).filter((cmd) =>
              availableCommands.includes(cmd)
            )
          : availableCommands
        return filtered.map((cmd) => ({
          itemKey: cmd.id,
          name: cmd.name,
          description: cmd.description,
          shortcut: cmd.displayShortcut,
          hasSubcommands: !!cmd.subcommands?.length,
          showShortcut: false,
          run: () => runCommand(cmd),
        }))
      }
      case 'main':
        return [
          {
            itemKey: '__search',
            name: 'Search commands',
            description: 'Search for commands by name and description',
            shortcut: 'S',
            hasSubcommands: false,
            showShortcut: true,
            run: enterSearchMode,
          },
          ...availableCommands.map((cmd) => ({
            itemKey: cmd.id,
            name: cmd.name,
            description: cmd.description,
            shortcut: cmd.displayShortcut,
            hasSubcommands: !!cmd.subcommands?.length,
            showShortcut: true,
            run: () => runCommand(cmd),
          })),
        ]
    }
  }, [
    mode,
    query,
    availableCommands,
    context,
    onClose,
    runCommand,
    enterSearchMode,
  ])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setMode({ kind: 'main' })
      setQuery('')
      setActiveIndex(0)
    }
  }, [isOpen])

  // The keydown listener stays attached for the whole time the palette is
  // open; it reads the current state through a ref instead of re-binding on
  // every keystroke and index change.
  const keyStateRef = useRef({ mode, items, activeIndex, availableCommands })
  keyStateRef.current = { mode, items, activeIndex, availableCommands }
  const callbacksRef = useRef({ onClose, runCommand, enterSearchMode, context })
  callbacksRef.current = { onClose, runCommand, enterSearchMode, context }

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const { mode, items, activeIndex, availableCommands } =
        keyStateRef.current
      const { onClose, runCommand, enterSearchMode, context } =
        callbacksRef.current

      // Allow system shortcuts (copy/paste/etc) to pass through
      if (e.metaKey || e.ctrlKey) {
        return
      }

      // In search mode, let typing keys reach the input field
      if (mode.kind === 'search') {
        const isTypingKey = e.key.length === 1 && !e.altKey
        const isEditKey = e.key === 'Backspace' || e.key === 'Delete'
        if (isTypingKey || isEditKey) {
          return
        }
      }

      // Prevent all other keyboard events from reaching the editor
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'ArrowDown') {
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }

      if (e.key === 'Enter') {
        items[activeIndex]?.run()
        return
      }

      // Escape steps back one mode; from main it closes
      if (e.key === 'Escape') {
        if (mode.kind === 'main') {
          onClose()
        } else {
          setMode({ kind: 'main' })
          setQuery('')
          setActiveIndex(0)
        }
        return
      }

      // Single-key shortcuts (not in search mode, where keys type)
      if (!e.altKey && e.key.length === 1) {
        const key = e.key.toLowerCase()

        if (mode.kind === 'sub') {
          const subcommand = mode.command.subcommands?.find(
            (sub) => sub.key.toLowerCase() === key
          )
          if (subcommand) {
            subcommand.execute(context)
            onClose()
          }
          return
        }

        if (mode.kind === 'main') {
          if (key === 's') {
            enterSearchMode()
            return
          }

          const command = getCommandByShortcut(e.key)
          if (command && availableCommands.includes(command)) {
            runCommand(command)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen])

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
        {mode.kind === 'sub' && (
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
            <div className="text-xs text-gray-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-gray-700">
              {mode.command.displayShortcut || mode.command.shortcut}
            </div>
            <span className="text-gray-400">+</span>
            <span className="text-gray-400 text-sm">...</span>
            <span className="ml-auto text-xs text-gray-500">
              ESC to go back
            </span>
          </div>
        )}
        {mode.kind === 'search' && (
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
          {items.map((item, idx) => (
            <CommandItem
              key={item.itemKey}
              name={item.name}
              description={item.description}
              shortcut={item.shortcut}
              hasSubcommands={item.hasSubcommands}
              isActive={idx === activeIndex}
              showShortcut={item.showShortcut}
              onClick={item.run}
              onMouseEnter={() => setActiveIndex(idx)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
