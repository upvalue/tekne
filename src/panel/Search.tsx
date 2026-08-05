// Search panel - sidebar-friendly search interface

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { trpc, type RouterOutputs } from '@/trpc/client'
import { parseQuery } from '@/search/query-parser'
import type { SearchViewMode } from '@/search/types'
import { ResultCardGrid } from './AggregateComponents'
import { ReadOnlyLine } from '@/editor/ReadOnlyLine'
import { SavedSearches } from './SavedSearches'
import {
  MagnifyingGlassIcon,
  Bars3BottomLeftIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

type SearchResultItem = RouterOutputs['search']['searchLines']['items'][number]

const OPERATOR_HELP: Array<{ operator: string; description: string }> = [
  { operator: '#tag', description: 'Filter by tag (prefix match)' },
  { operator: 'age:90d', description: 'Last N days/weeks/months' },
  { operator: 'status:', description: 'complete / incomplete / unset' },
  { operator: 'has:', description: 'timer / task / pin' },
  { operator: 'doc:', description: 'Document name pattern' },
]

const PanelEmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="text-center text-zinc-400 text-sm py-8">{children}</div>
)

// Search result card - shows document title and ReadOnlyLine
const SearchResultCard = ({
  item,
  onNavigate,
}: {
  item: SearchResultItem
  onNavigate: () => void
}) => {
  return (
    <div
      className="rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden cursor-pointer"
      onClick={onNavigate}
    >
      {/* Document header */}
      <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">
            {item.note_title}
          </span>
          {item.child_count > 0 && (
            <span className="text-xs text-zinc-500">
              +{item.child_count} line{item.child_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Line content using ReadOnlyLine */}
      <div className="px-2 py-1">
        <ReadOnlyLine
          content={item.content}
          indent={item.indent}
          datumTaskStatus={item.datum_task_status ?? undefined}
          datumTimeSeconds={item.datum_time_seconds ?? undefined}
          datumPinnedAt={item.datum_pinned_at ?? undefined}
        />
      </div>
    </div>
  )
}

const LinesResults = ({
  isLoading,
  errorMessage,
  data,
  onNavigate,
}: {
  isLoading: boolean
  errorMessage?: string
  data?: RouterOutputs['search']['searchLines']
  onNavigate: (noteTitle: string) => void
}) => {
  if (isLoading) {
    return <PanelEmptyState>Searching...</PanelEmptyState>
  }
  if (errorMessage) {
    return <PanelEmptyState>{errorMessage}</PanelEmptyState>
  }

  const items = data?.items ?? []
  if (items.length === 0) {
    return <PanelEmptyState>No results found</PanelEmptyState>
  }

  return (
    <>
      <div className="text-xs text-zinc-500 px-1 mb-3">
        {items.length} result{items.length !== 1 ? 's' : ''}
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <SearchResultCard
            key={`${item.note_title}-${item.line_idx}-${idx}`}
            item={item}
            onNavigate={() => onNavigate(item.note_title)}
          />
        ))}
      </div>
      {data?.nextCursor && (
        <div className="text-center text-zinc-500 text-sm py-3">
          More results available...
        </div>
      )}
    </>
  )
}

const AggregateResults = ({
  isLoading,
  errorMessage,
  data,
}: {
  isLoading: boolean
  errorMessage?: string
  data?: RouterOutputs['search']['searchAggregate']
}) => {
  if (isLoading) {
    return <PanelEmptyState>Loading...</PanelEmptyState>
  }
  if (errorMessage) {
    return <PanelEmptyState>{errorMessage}</PanelEmptyState>
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return <PanelEmptyState>No matching tags</PanelEmptyState>
  }

  return (
    <>
      <div className="text-xs text-zinc-500 mb-4">
        {rows.length} tag{rows.length !== 1 ? 's' : ''}
      </div>
      <ResultCardGrid data={rows} />
    </>
  )
}

const SearchHelp = () => (
  <div className="p-4 space-y-4">
    <p className="text-sm text-zinc-300 font-medium">
      Search across all documents
    </p>
    <div className="space-y-2">
      {OPERATOR_HELP.map(({ operator, description }) => (
        <div key={operator} className="flex items-start gap-3 text-sm">
          <code className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded font-mono text-xs shrink-0">
            {operator}
          </code>
          <span className="text-zinc-400">{description}</span>
        </div>
      ))}
    </div>
  </div>
)

export const Search = () => {
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<SearchViewMode>('text')
  const navigate = useNavigate()

  // Debounce query for API calls (300ms)
  const debouncedQuery = useDebouncedValue(query, 300)

  // Parse both for instant validation feedback and debounced for queries
  const parsedQuery = useMemo(() => parseQuery(query), [query])
  const debouncedParsedQuery = useMemo(
    () => parseQuery(debouncedQuery),
    [debouncedQuery]
  )

  const hasValidQuery =
    parsedQuery.operators.length > 0 && parsedQuery.errors.length === 0
  const hasDebouncedValidQuery =
    debouncedParsedQuery.operators.length > 0 &&
    debouncedParsedQuery.errors.length === 0

  // Search queries use debounced value
  const linesQuery = trpc.search.searchLines.useQuery(
    { operators: debouncedParsedQuery.operators },
    { enabled: hasDebouncedValidQuery && viewMode === 'text' }
  )

  const aggregateQuery = trpc.search.searchAggregate.useQuery(
    { operators: debouncedParsedQuery.operators },
    { enabled: hasDebouncedValidQuery && viewMode === 'aggregate' }
  )

  const handleNavigateToResult = useCallback(
    (noteTitle: string) => {
      navigate({ to: '/n/$title', params: { title: noteTitle } })
    },
    [navigate]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="p-4 space-y-3 border-b border-zinc-800">
        <SavedSearches currentQuery={query} onSelectSearch={setQuery} />

        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="#exercise age:90d..."
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
        {!hasValidQuery ? (
          query.trim() ? (
            <PanelEmptyState>Fix the errors above to search</PanelEmptyState>
          ) : (
            <SearchHelp />
          )
        ) : viewMode === 'text' ? (
          <div className="p-3 space-y-2">
            <LinesResults
              isLoading={linesQuery.isLoading}
              errorMessage={linesQuery.error?.message}
              data={linesQuery.data}
              onNavigate={handleNavigateToResult}
            />
          </div>
        ) : (
          <div className="p-4">
            <AggregateResults
              isLoading={aggregateQuery.isLoading}
              errorMessage={aggregateQuery.error?.message}
              data={aggregateQuery.data}
            />
          </div>
        )}
      </div>
    </div>
  )
}
