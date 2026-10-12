import { ErrorState } from '@/components/ErrorState'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import { useQuery } from '@tanstack/react-query'
// Search panel - sidebar-friendly search interface

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { orpc, type RouterOutputs } from '@/api/client'
import { parseQuery } from '@/search/query-parser'
import type { SearchViewMode } from '@/search/types'
import { ResultCardGrid } from './AggregateComponents'
import { ReadOnlyLine } from '@/editor/ReadOnlyLine'
import { SavedSearches } from './SavedSearches'
import { Search as SearchIcon, AlignLeft, ChartColumn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearchFocusRequested } from '@/hooks/panel-state'

const OPERATOR_HELP: Array<{ operator: string; description: string }> = [
  { operator: '#tag', description: 'Filter by tag (prefix match)' },
  { operator: 'age:90d', description: 'Last N days/weeks/months' },
  { operator: 'status:', description: 'complete / incomplete / unset' },
  { operator: 'has:', description: 'timer / task / pin' },
  { operator: 'doc:', description: 'Document name pattern' },
]

const PanelEmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="text-center text-text-2 text-sm py-8">{children}</div>
)

const LinesResults = ({
  isLoading,
  errorMessage,
  onRetry,
  data,
  onNavigate,
}: {
  isLoading: boolean
  errorMessage?: string
  onRetry: () => void
  data?: RouterOutputs['search']['searchLines']
  onNavigate: (noteTitle: string) => void
}) => {
  if (isLoading) {
    return (
      <PanelEmptyState>
        <LoadingIndicator label="Searching" />
      </PanelEmptyState>
    )
  }
  if (errorMessage) {
    return (
      <ErrorState
        title="Search unavailable"
        message="Your query is still here. Try the search again."
        detail={errorMessage}
        onRetry={onRetry}
      />
    )
  }

  const items = data?.items ?? []
  if (items.length === 0) {
    return <PanelEmptyState>No results found</PanelEmptyState>
  }

  return (
    <>
      <div className="text-xs text-muted px-1 mb-3">
        {items.length} result{items.length !== 1 ? 's' : ''}
      </div>
      <div className="space-y-6">
        {Array.from(new Set(items.map((item) => item.note_title))).map(
          (title) => (
            <section key={title}>
              <button
                className="text-sm text-text-2 mb-2 hover:text-text"
                onClick={() => onNavigate(title)}
              >
                {title}
              </button>
              {items
                .filter((item) => item.note_title === title)
                .map((item) => (
                  <ReadOnlyLine
                    key={`${item.note_title}-${item.line_idx}`}
                    content={item.content}
                    indent={0}
                    datumTaskStatus={item.datum_task_status ?? undefined}
                    datumTimeSeconds={item.datum_time_seconds ?? undefined}
                    datumPinnedAt={item.datum_pinned_at ?? undefined}
                    onClick={() => onNavigate(item.note_title)}
                  />
                ))}
            </section>
          )
        )}
      </div>
      {data?.nextCursor && (
        <div className="text-center text-muted text-sm py-3">
          More results available...
        </div>
      )}
    </>
  )
}

const AggregateResults = ({
  isLoading,
  errorMessage,
  onRetry,
  data,
}: {
  isLoading: boolean
  errorMessage?: string
  onRetry: () => void
  data?: RouterOutputs['search']['searchAggregate']
}) => {
  if (isLoading) {
    return (
      <PanelEmptyState>
        <LoadingIndicator label="Loading search results" />
      </PanelEmptyState>
    )
  }
  if (errorMessage) {
    return (
      <ErrorState
        title="Search unavailable"
        message="Your query is still here. Try the search again."
        detail={errorMessage}
        onRetry={onRetry}
      />
    )
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return <PanelEmptyState>No matching tags</PanelEmptyState>
  }

  return (
    <>
      <div className="text-xs text-muted mb-4">
        {rows.length} tag{rows.length !== 1 ? 's' : ''}
      </div>
      <ResultCardGrid data={rows} />
    </>
  )
}

const SearchHelp = () => (
  <div className="p-3 space-y-4">
    <p className="text-sm text-text-2 font-medium">
      Search across all documents
    </p>
    <div className="space-y-2">
      {OPERATOR_HELP.map(({ operator, description }) => (
        <div key={operator} className="flex items-start gap-3 text-sm">
          <code className="bg-raised text-text px-2 py-1 rounded font-mono text-xs shrink-0">
            {operator}
          </code>
          <span className="text-text-2">{description}</span>
        </div>
      ))}
    </div>
  </div>
)

export const Search = () => {
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<SearchViewMode>('text')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [focusRequested, setFocusRequested] = useSearchFocusRequested()

  useEffect(() => {
    if (!focusRequested) return
    inputRef.current?.focus()
    inputRef.current?.select()
    setFocusRequested(false)
  }, [focusRequested, setFocusRequested])

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
  const linesQuery = useQuery(
    orpc.search.searchLines.queryOptions({
      input: { operators: debouncedParsedQuery.operators },
      enabled: hasDebouncedValidQuery && viewMode === 'text',
    })
  )

  const aggregateQuery = useQuery(
    orpc.search.searchAggregate.queryOptions({
      input: { operators: debouncedParsedQuery.operators },
      enabled: hasDebouncedValidQuery && viewMode === 'aggregate',
    })
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
      <div className="px-3 py-2 space-y-3">
        {/* Search input */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-text-2" />
          <input
            ref={inputRef}
            aria-label="Search query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="#exercise age:90d..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-raised border-0 rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent-fill focus:border-transparent transition-shadow"
          />
        </div>

        {query && (
          <div aria-label="Search suggestions" className="flex flex-wrap gap-1">
            {[
              '#',
              'age:7d',
              'status:unset',
              'status:complete',
              'has:timer',
              'has:task',
              'has:pin',
              'doc:',
            ]
              .filter((operator) =>
                operator.startsWith(query.split(/\s+/).at(-1) || '')
              )
              .map((operator) => (
                <button
                  key={operator}
                  className="text-xs text-text-2 bg-white/5 rounded px-2 py-1"
                  onClick={() =>
                    setQuery(query.replace(/\S*$/, operator + ' '))
                  }
                >
                  {operator}
                </button>
              ))}
          </div>
        )}
        <SavedSearches currentQuery={query} onSelectSearch={setQuery} />

        {parsedQuery.errors.length > 0 && (
          <div className="text-accent text-sm font-medium bg-accent-fill/10 px-3 py-2 rounded-lg">
            {parsedQuery.errors.map((e, i) => (
              <div key={i}>{e.message}</div>
            ))}
          </div>
        )}

        {/* View mode toggle */}
        {hasValidQuery && (
          <div className="flex gap-1 bg-raised p-1 rounded-lg">
            <button
              onClick={() => setViewMode('text')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all',
                viewMode === 'text'
                  ? 'bg-raised text-text shadow-sm'
                  : 'text-text-2 hover:text-text'
              )}
            >
              <AlignLeft className="size-4" />
              Lines
            </button>
            <button
              onClick={() => setViewMode('aggregate')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all',
                viewMode === 'aggregate'
                  ? 'bg-raised text-text shadow-sm'
                  : 'text-text-2 hover:text-text'
              )}
            >
              <ChartColumn className="size-4" />
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
              onRetry={() => void linesQuery.refetch()}
              isLoading={linesQuery.isLoading}
              errorMessage={linesQuery.error?.message}
              data={linesQuery.data}
              onNavigate={handleNavigateToResult}
            />
          </div>
        ) : (
          <div className="p-4">
            <AggregateResults
              onRetry={() => void aggregateQuery.refetch()}
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
