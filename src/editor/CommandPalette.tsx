import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { EditorView } from '@codemirror/view'
import { useAtom, useStore } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { orpc } from '@/api/client'
import { useCreateDoc } from '@/hooks/useCreateDoc'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getAllCommands, type CommandContext } from './command-registry'
import { cn } from '@/lib/utils'
import { commandPaletteSearchAtom } from './state'

const GROUPS = ['This line', 'Go to', 'Panel', 'Tools', 'Help'] as const
type Group = (typeof GROUPS)[number]
type Item = {
  id: string
  name: string
  description: string
  group: Group
  keys?: string[]
  run: () => void | Promise<void>
}

export const CommandPalette = ({
  isOpen,
  onClose,
  lineIdx,
  view,
}: {
  isOpen: boolean
  onClose: () => void
  lineIdx: number | null
  view: EditorView | null
}) => {
  const store = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useAtom(commandPaletteSearchAtom)
  const [prefix, setPrefix] = useState('')
  const popup = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const debounced = useDebouncedValue(query, 150)
  const docs = useQuery(
    orpc.doc.searchDocs.queryOptions({
      input: { query: debounced },
      enabled: isOpen,
    })
  )
  const createDoc = useCreateDoc({
    onSuccess: (title) => {
      void navigate({ to: '/n/$title', params: { title } })
      onClose()
    },
  })
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActive(-1)
    }
  }, [isOpen])
  const items = useMemo(() => {
    const context: CommandContext = { store, lineIdx, view }
    const result: Item[] = []
    for (const command of getAllCommands()) {
      if (command.requiresEditor && lineIdx === null) continue
      const group: Group = command.requiresEditor
        ? 'This line'
        : command.id === 'help' || command.id === 'tutorial'
          ? 'Help'
          : ['search', 'toggle-panel', 'page-panel'].includes(command.id)
            ? 'Panel'
            : [
                  'tools',
                  'rename-tags',
                  'cleanup',
                  'display-mode',
                  'delete-doc',
                  'devtools',
                ].includes(command.id)
              ? 'Tools'
              : 'Go to'
      for (const entry of command.subcommands ?? [command]) {
        if (
          query &&
          !`${entry.name} ${entry.description} ${command.keywords?.join(' ') ?? ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          continue
        result.push({
          id: `${command.id}:${entry.name}`,
          name: entry.name,
          description: entry.description,
          group,
          keys: command.shortcut
            ? 'key' in entry
              ? [command.shortcut, entry.key]
              : [command.shortcut]
            : undefined,
          run: () => entry.execute(context),
        })
      }
    }
    for (const doc of (docs.data ?? []).filter((doc) =>
      doc.title.toLowerCase().includes(query.toLowerCase())
    ))
      result.push({
        id: `doc:${doc.id}`,
        name: doc.title,
        description: 'Open document',
        group: 'Go to',
        run: () => {
          void navigate({ to: '/n/$title', params: { title: doc.title } })
        },
      })
    if (
      query.trim() &&
      !docs.data?.some(
        (doc) => doc.title.toLowerCase() === query.trim().toLowerCase()
      )
    ) {
      result.push({
        id: 'create',
        name: `Create “${query.trim()}”`,
        description: 'New document',
        group: 'Go to',
        run: () => createDoc.mutate({ name: query.trim() }),
      })
    }
    return result
      .filter((item) => !prefix || item.keys?.[0] === prefix)
      .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group))
  }, [store, lineIdx, view, query, docs.data, navigate, createDoc, prefix])
  const activeIndex =
    active < 0
      ? Math.max(
          0,
          items.findIndex(
            (item) => !item.id.startsWith('doc:') && item.id !== 'create'
          )
        )
      : Math.min(active, items.length - 1)
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])
  const run = (item: Item) => {
    void item.run()
    onClose()
  }
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-transparent" />
        <Dialog.Popup
          ref={popup}
          tabIndex={-1}
          initialFocus={() => (searchMode ? input.current : popup.current)}
          onKeyDown={(event) => {
            if (
              searchMode ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              event.nativeEvent.isComposing
            )
              return
            const key = event.key.toLowerCase()
            if (key === 'escape' && prefix) {
              event.preventDefault()
              event.stopPropagation()
              setPrefix('')
              return
            }
            if (key === 's' && !prefix) {
              event.preventDefault()
              setSearchMode(true)
              input.current?.focus()
              return
            }
            const exact = items.find(
              (item) =>
                item.keys &&
                (prefix
                  ? item.keys[0] === prefix && item.keys[1] === key
                  : item.keys.length === 1 && item.keys[0] === key)
            )
            if (exact) {
              event.preventDefault()
              run(exact)
              return
            }
            if (
              !prefix &&
              items.some(
                (item) => item.keys?.length === 2 && item.keys[0] === key
              )
            ) {
              event.preventDefault()
              setPrefix(key)
              setActive(-1)
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setActive(
                Math.max(
                  0,
                  Math.min(
                    items.length - 1,
                    activeIndex + (event.key === 'ArrowDown' ? 1 : -1)
                  )
                )
              )
            }
            if (event.key === 'Enter' && items[activeIndex]) {
              event.preventDefault()
              run(items[activeIndex])
            }
          }}
          finalFocus={
            view
              ? () => {
                  view.focus()
                  return null
                }
              : undefined
          }
          className="CommandPalette-container fixed top-[18vh] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl rounded-xl p-2 text-text outline-none"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <input
            ref={input}
            onFocus={() => {
              setSearchMode(true)
              setPrefix('')
            }}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(-1)
            }}
            className="mb-1 w-full border-b border-white/8 bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted"
            placeholder={
              searchMode
                ? 'Find a command or document…'
                : 'S to search, or use a shortcut below'
            }
            aria-label="Find a command or document"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={
              items[activeIndex] ? `palette-item-${activeIndex}` : undefined
            }
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((index) =>
                  Math.max(
                    0,
                    Math.min(
                      items.length - 1,
                      (index < 0 ? activeIndex : index) +
                        (e.key === 'ArrowDown' ? 1 : -1)
                    )
                  )
                )
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                if (items[activeIndex]) run(items[activeIndex])
              }
            }}
          />
          <div
            ref={list}
            id="palette-results"
            role="listbox"
            className="max-h-[55vh] overflow-y-auto"
          >
            {items.map((item, index) => (
              <div key={item.id}>
                {(index === 0 || items[index - 1].group !== item.group) && (
                  <div className="px-3 pt-4 pb-2 text-xs text-muted">
                    {item.group}
                  </div>
                )}
                <div
                  id={`palette-item-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(item)}
                  className={cn(
                    'px-3 py-2 rounded-md cursor-pointer flex items-center justify-between gap-4',
                    activeIndex === index && 'bg-white/7'
                  )}
                >
                  <span className="text-sm">{item.name}</span>
                  {!searchMode && item.keys && (
                    <kbd className="ml-auto whitespace-nowrap text-xs text-muted">
                      {item.keys.join(' › ').toUpperCase()}
                    </kbd>
                  )}
                  <span className="text-xs text-muted truncate max-w-[50%]">
                    {item.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
