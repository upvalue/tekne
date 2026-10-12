import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { orpc } from '@/api/client'
import { toast } from 'sonner'

export const SavedSearches = ({
  currentQuery,
  onSelectSearch,
}: {
  currentQuery: string
  onSelectSearch: (query: string) => void
}) => {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const utils = useQueryClient()
  const { data = [] } = useQuery(
    orpc.search.getSavedSearches.queryOptions({ input: undefined })
  )
  const refresh = () =>
    utils.invalidateQueries({ queryKey: orpc.search.getSavedSearches.key() })
  const save = useMutation(
    orpc.search.saveSearch.mutationOptions({
      onSuccess: () => {
        void refresh()
        setAdding(false)
        setName('')
        toast.success('Search saved')
      },
      onError: (e) => toast.error(e.message),
    })
  )
  const remove = useMutation(
    orpc.search.deleteSavedSearch.mutationOptions({
      onSuccess: () => {
        void refresh()
      },
      onError: (e) => toast.error(e.message),
    })
  )
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {data.map((search) => (
          <div
            key={search.id}
            className="group flex items-center rounded bg-white/5 text-text-2"
          >
            <button
              className="px-2 py-1.5 hover:text-text"
              onClick={() => onSelectSearch(search.query)}
            >
              {search.name}
            </button>
            <button
              aria-label={`Delete saved search ${search.name}`}
              className="pr-1.5 text-muted hover:text-text"
              onClick={() => {
                remove.mutate(
                  { id: search.id },
                  {
                    onSuccess: () =>
                      toast.success('Saved search deleted', {
                        action: {
                          label: 'Undo',
                          onClick: () =>
                            save.mutate({
                              name: search.name,
                              query: search.query,
                            }),
                        },
                      }),
                  }
                )
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {currentQuery.trim() && (
          <button
            className="flex items-center gap-1 px-2 py-1 text-muted hover:text-text"
            onClick={() => setAdding(!adding)}
          >
            <Plus size={12} />
            Save search
          </button>
        )}
        {!data.length && !currentQuery.trim() && (
          <span className="text-muted">Saved searches will appear here.</span>
        )}
      </div>
      {adding && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim())
              save.mutate({ name: name.trim(), query: currentQuery })
          }}
        >
          <input
            autoFocus
            aria-label="Search name"
            placeholder="Search name"
            className="min-w-0 flex-1 rounded bg-raised px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={save.isPending || !name.trim()}
            className="rounded bg-mark text-text px-2 text-xs hover:brightness-125"
          >
            Save
          </button>
        </form>
      )}
    </div>
  )
}
