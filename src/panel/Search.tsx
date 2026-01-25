// Search panel - sidebar-friendly search interface

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '@/trpc/client'
import { parseQuery } from '@/search/query-parser'
import type { SearchOperator, SearchViewMode } from '@/search/types'
import { ResultCardGrid } from './AggregateComponents'
import {
  MagnifyingGlassIcon,
  Bars3BottomLeftIcon,
  ChartBarIcon,
  BookmarkIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

// Compact text result row for sidebar
interface TextResultItem {
  note_title: string
  line_idx: number
  content: string
  time_created: Date | string
  tags: string[]
  has_timer: boolean
  has_task: boolean
  task_status: string | null
}

const TextResultRow = ({ item }: { item: TextResultItem }) => {
  return (
    <Link
      to="/n/$title"
      params={{ title: item.note_title }}
      className="block p-2 hover:bg-zinc-700/50 rounded transition-colors"
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-0.5">
        <span className="font-medium text-zinc-400 truncate">
          {item.note_title}
        </span>
        <span>:{item.line_idx + 1}</span>
        {item.has_timer && <ClockIcon className="size-3 text-blue-400" />}
        {item.has_task &&
          (item.task_status === 'complete' ? (
            <CheckCircleIcon className="size-3 text-green-400" />
          ) : (
            <XCircleIcon className="size-3 text-zinc-400" />
          ))}
      </div>
      <div className="text-sm text-zinc-200 truncate">
        {item.content || '(empty)'}
      </div>
    </Link>
  )
}

// Saved searches dropdown component
const SavedSearchesDropdown = ({
  currentQuery,
  onSelectSearch,
}: {
  currentQuery: string
  onSelectSearch: (query: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const utils = trpc.useUtils()
  const { data: savedSearches } = trpc.search.getSavedSearches.useQuery()

  const saveMutation = trpc.search.saveSearch.useMutation({
    onSuccess: () => {
      utils.search.getSavedSearches.invalidate()
      setIsAdding(false)
      setNewName('')
    },
  })

  const deleteMutation = trpc.search.deleteSavedSearch.useMutation({
    onSuccess: () => {
      utils.search.getSavedSearches.invalidate()
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setIsAdding(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSave = () => {
    if (newName.trim() && currentQuery.trim()) {
      saveMutation.mutate({ name: newName.trim(), query: currentQuery })
    }
  }

  const handleSelectAndClose = (query: string) => {
    onSelectSearch(query)
    setIsOpen(false)
  }

  const count = savedSearches?.length || 0

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors w-full',
          isOpen
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        )}
      >
        <BookmarkIcon className="size-3.5" />
        <span className="flex-1 text-left">
          {count > 0 ? `Saved (${count})` : 'Saved Searches'}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
          {/* Save current search option */}
          {currentQuery.trim() && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full px-3 py-2 text-xs text-left text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 flex items-center gap-2 border-b border-zinc-700"
            >
              <PlusIcon className="size-3" />
              Save current search
            </button>
          )}

          {/* Save form */}
          {isAdding && (
            <div className="p-2 border-b border-zinc-700 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Search name..."
                autoFocus
                className="w-full px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-600 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') setIsAdding(false)
                }}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSave}
                  disabled={!newName.trim() || saveMutation.isPending}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Saved searches list */}
          {savedSearches && savedSearches.length > 0 ? (
            <div className="py-1">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-zinc-700/50 cursor-pointer group"
                  onClick={() => handleSelectAndClose(search.query)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-200 truncate">
                      {search.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {search.query}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate({ id: search.id })
                    }}
                    className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <TrashIcon className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-xs text-zinc-500 text-center">
              No saved searches yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const Search = () => {
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<SearchViewMode>('text')

  // Parse the query
  const parsedQuery = useMemo(() => parseQuery(query), [query])
  const hasValidQuery =
    parsedQuery.operators.length > 0 && parsedQuery.errors.length === 0

  // Search queries
  const linesQuery = trpc.search.searchLines.useQuery(
    { operators: parsedQuery.operators as SearchOperator[] },
    { enabled: hasValidQuery && viewMode === 'text' }
  )

  const aggregateQuery = trpc.search.searchAggregate.useQuery(
    { operators: parsedQuery.operators as SearchOperator[] },
    { enabled: hasValidQuery && viewMode === 'aggregate' }
  )

  const handleSelectSearch = useCallback((savedQuery: string) => {
    setQuery(savedQuery)
  }, [])

  const items = (linesQuery.data?.items || []) as TextResultItem[]

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="p-3 space-y-2 border-b border-zinc-800">
        {/* Saved searches dropdown */}
        <SavedSearchesDropdown
          currentQuery={query}
          onSelectSearch={handleSelectSearch}
        />

        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="tag:exercise age:90d..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {parsedQuery.errors.length > 0 && (
          <div className="text-red-400 text-xs">
            {parsedQuery.errors.map((e, i) => (
              <div key={i}>{e.message}</div>
            ))}
          </div>
        )}

        {/* View mode toggle */}
        {hasValidQuery && (
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('text')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded transition-colors',
                viewMode === 'text'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              <Bars3BottomLeftIcon className="size-3" />
              Lines
            </button>
            <button
              onClick={() => setViewMode('aggregate')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded transition-colors',
                viewMode === 'aggregate'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              <ChartBarIcon className="size-3" />
              Aggregate
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {hasValidQuery ? (
          viewMode === 'text' ? (
            <div className="p-2">
              {linesQuery.isLoading ? (
                <div className="text-center text-zinc-500 text-sm py-4">
                  Searching...
                </div>
              ) : items.length > 0 ? (
                <div className="space-y-1">
                  {items.map((item, idx) => (
                    <TextResultRow
                      key={`${item.note_title}-${item.line_idx}-${idx}`}
                      item={item}
                    />
                  ))}
                  {linesQuery.data?.nextCursor && (
                    <div className="text-center text-zinc-500 text-xs py-2">
                      More results available...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-zinc-500 text-sm py-4">
                  No results found
                </div>
              )}
            </div>
          ) : (
            <div className="p-3">
              {aggregateQuery.isLoading ? (
                <div className="text-center text-zinc-500 text-sm py-4">
                  Loading...
                </div>
              ) : aggregateQuery.data && aggregateQuery.data.length > 0 ? (
                <ResultCardGrid data={aggregateQuery.data} />
              ) : (
                <div className="text-center text-zinc-500 text-sm py-4">
                  No matching tags
                </div>
              )}
            </div>
          )
        ) : query.trim() ? (
          <div className="text-center text-zinc-500 text-sm py-4 px-3">
            Fix errors above to search
          </div>
        ) : (
          <div className="p-3 text-xs text-zinc-500 space-y-2">
            <p>Search across all documents using:</p>
            <ul className="space-y-1 text-zinc-400">
              <li>
                <code className="bg-zinc-800 px-1 rounded">tag:</code> filter by
                tag
              </li>
              <li>
                <code className="bg-zinc-800 px-1 rounded">age:90d</code> last N
                days/weeks/months
              </li>
              <li>
                <code className="bg-zinc-800 px-1 rounded">status:</code>{' '}
                complete/incomplete/unset
              </li>
              <li>
                <code className="bg-zinc-800 px-1 rounded">has:</code>{' '}
                timer/task/pin
              </li>
              <li>
                <code className="bg-zinc-800 px-1 rounded">doc:</code> document
                pattern
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
