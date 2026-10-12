import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { EditorView } from '@codemirror/view'
import { useStore } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { orpc } from '@/api/client'
import { useCreateDoc } from '@/hooks/useCreateDoc'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getAllCommands, type CommandContext } from './command-registry'
import { cn } from '@/lib/utils'

const GROUPS = ['This line', 'Go to', 'Panel', 'Tools', 'Help'] as const
type Group = (typeof GROUPS)[number]
type Item = {
  id: string
  name: string
  description: string
  group: Group
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
  const [active, setActive] = useState(0)
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
      setActive(0)
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
          !`${entry.name} ${entry.description}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          continue
        result.push({
          id: `${command.id}:${entry.name}`,
          name: entry.name,
          description: entry.description,
          group,
          run: () => entry.execute(context),
        })
      }
    }
    for (const doc of docs.data ?? [])
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
    return result.sort(
      (a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)
    )
  }, [store, lineIdx, view, query, docs.data, navigate, createDoc])
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])
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
          initialFocus={input}
          finalFocus={
            view
              ? () => {
                  view.focus()
                  return null
                }
              : undefined
          }
          className="CommandPalette-container fixed top-[18vh] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl rounded-xl bg-raised p-2 text-text shadow-xl outline-none"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            className="w-full bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted"
            placeholder="Find a command or document…"
            aria-label="Find a command or document"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={
              items[active] ? `palette-item-${active}` : undefined
            }
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((index) =>
                  Math.max(
                    0,
                    Math.min(
                      items.length - 1,
                      index + (e.key === 'ArrowDown' ? 1 : -1)
                    )
                  )
                )
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                if (items[active]) run(items[active])
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
                  aria-selected={active === index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(item)}
                  className={cn(
                    'px-3 py-2 rounded-md cursor-pointer flex items-center justify-between gap-4',
                    active === index && 'bg-white/7'
                  )}
                >
                  <span className="text-sm">{item.name}</span>
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
