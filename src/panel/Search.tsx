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
      className="block px-3 py-2.5 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
    >
      <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
        <span className="font-medium text-zinc-300">{item.note_title}</span>
        <span className="text-zinc-500">:{item.line_idx + 1}</span>
        {item.has_timer && <ClockIcon className="size-3.5 text-blue-400" />}
        {item.has_task &&
          (item.task_status === 'complete' ? (
            <CheckCircleIcon className="size-3.5 text-green-400" />
          ) : (
            <XCircleIcon className="size-3.5 text-zinc-500" />
          ))}
      </div>
      <div className="text-sm text-zinc-100 leading-relaxed line-clamp-2">
        {item.content || <span className="text-zinc-500 italic">empty line</span>}
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
          'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all w-full',
          isOpen
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'
        )}
      >
        <BookmarkIcon className="size-4" />
        <span className="flex-1 text-left">
          {count > 0 ? `Saved Searches (${count})` : 'Saved Searches'}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 transition-transform text-zinc-400',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-600 rounded-xl shadow-xl z-10 max-h-72 overflow-auto">
          {/* Save current search option */}
          {currentQuery.trim() && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full px-4 py-3 text-sm text-left text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 flex items-center gap-2 border-b border-zinc-700"
            >
              <PlusIcon className="size-4" />
              Save current search
            </button>
          )}

          {/* Save form */}
          {isAdding && (
            <div className="p-3 border-b border-zinc-700 space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Search name..."
                autoFocus
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') setIsAdding(false)
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!newName.trim() || saveMutation.isPending}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-white transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 rounded-lg transition-colors"
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
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-700 cursor-pointer group transition-colors"
                  onClick={() => handleSelectAndClose(search.query)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-100 truncate">
                      {search.name}
                    </div>
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {search.query}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate({ id: search.id })
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-zinc-500 text-center">
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
      <div className="p-4 space-y-3 border-b border-zinc-800">
        {/* Saved searches dropdown */}
        <SavedSearchesDropdown
          currentQuery={query}
          onSelectSearch={handleSelectSearch}
        />

        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="tag:exercise age:90d..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        {parsedQuery.errors.length > 0 && (
          <div className="text-red-400 text-sm font-medium bg-red-500/10 px-3 py-2 rounded-lg">
            {parsedQuery.errors.map((e, i) => (
              <div key={i}>{e.message}</div>
            ))}
          </div>
        )}

        {/* View mode toggle */}
        {hasValidQuery && (
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('text')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all',
                viewMode === 'text'
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Bars3BottomLeftIcon className="size-4" />
              Lines
            </button>
            <button
              onClick={() => setViewMode('aggregate')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all',
                viewMode === 'aggregate'
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <ChartBarIcon className="size-4" />
              Aggregate
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {hasValidQuery ? (
          viewMode === 'text' ? (
            <div className="p-3 space-y-2">
              {linesQuery.isLoading ? (
                <div className="text-center text-zinc-400 text-sm py-8">
                  Searching...
                </div>
              ) : items.length > 0 ? (
                <>
                  <div className="text-xs text-zinc-500 px-1 mb-3">
                    {items.length} result{items.length !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <TextResultRow
                        key={`${item.note_title}-${item.line_idx}-${idx}`}
                        item={item}
                      />
                    ))}
                  </div>
                  {linesQuery.data?.nextCursor && (
                    <div className="text-center text-zinc-500 text-sm py-3">
                      More results available...
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-zinc-400 text-sm py-8">
                  No results found
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              {aggregateQuery.isLoading ? (
                <div className="text-center text-zinc-400 text-sm py-8">
                  Loading...
                </div>
              ) : aggregateQuery.data && aggregateQuery.data.length > 0 ? (
                <>
                  <div className="text-xs text-zinc-500 mb-4">
                    {aggregateQuery.data.length} tag
                    {aggregateQuery.data.length !== 1 ? 's' : ''}
                  </div>
                  <ResultCardGrid data={aggregateQuery.data} />
                </>
              ) : (
                <div className="text-center text-zinc-400 text-sm py-8">
                  No matching tags
                </div>
              )}
            </div>
          )
        ) : query.trim() ? (
          <div className="text-center text-zinc-400 text-sm py-8 px-4">
            Fix the errors above to search
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <p className="text-sm text-zinc-300 font-medium">
              Search across all documents
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-sm">
                <code className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded font-mono text-xs shrink-0">
                  tag:
                </code>
                <span className="text-zinc-400">Filter by tag prefix</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <code className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded font-mono text-xs shrink-0">
                  age:90d
                </code>
                <span className="text-zinc-400">Last N days/weeks/months</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <code className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded font-mono text-xs shrink-0">
                  status:
                </code>
                <span className="text-zinc-400">
                  complete / incomplete / unset
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <code className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded font-mono text-xs shrink-0">
                  has:
                </code>
                <span className="text-zinc-400">timer / task / pin</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <code className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded font-mono text-xs shrink-0">
                  doc:
                </code>
                <span className="text-zinc-400">Document name pattern</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
