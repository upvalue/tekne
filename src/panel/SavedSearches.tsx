import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
// Saved-searches dropdown for the search panel: list, apply, save the
// current query, delete. Built on the Base UI popover so outside-click,
// Escape, and focus handling come from the kit instead of a hand-rolled
// document listener.
import { useState } from 'react'
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@/components/vendor/Popover'
import { Bookmark, Trash2, Plus, ChevronDown } from 'lucide-react'
import { orpc } from '@/api/client'
import { cn } from '@/lib/utils'

export const SavedSearches = ({
  currentQuery,
  onSelectSearch,
}: {
  currentQuery: string
  onSelectSearch: (query: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const utils = useQueryClient()
  const { data: savedSearches } = useQuery(
    orpc.search.getSavedSearches.queryOptions({ input: undefined })
  )

  const saveMutation = useMutation(
    orpc.search.saveSearch.mutationOptions({
      onSuccess: () => {
        utils.invalidateQueries({
          queryKey: orpc.search.getSavedSearches.key(),
        })
        setIsAdding(false)
        setNewName('')
      },
    })
  )

  const deleteMutation = useMutation(
    orpc.search.deleteSavedSearch.mutationOptions({
      onSuccess: () => {
        utils.invalidateQueries({
          queryKey: orpc.search.getSavedSearches.key(),
        })
      },
    })
  )

  const handleSave = () => {
    if (newName.trim() && currentQuery.trim()) {
      saveMutation.mutate({ name: newName.trim(), query: currentQuery })
    }
  }

  const count = savedSearches?.length || 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverButton
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all w-full focus:outline-none',
          open
            ? 'bg-raised text-text'
            : 'text-text-2 hover:text-text hover:bg-raised'
        )}
      >
        <Bookmark className="size-4" />
        <span className="flex-1 text-left">
          {count > 0 ? `Saved Searches (${count})` : 'Saved Searches'}
        </span>
        <ChevronDown
          className={cn(
            'size-4 transition-transform text-text-2',
            open && 'rotate-180'
          )}
        />
      </PopoverButton>

      <PopoverPanel className="bg-raised border border-muted rounded-xl shadow-xl max-h-72 overflow-auto">
        {/* Save current search option */}
        {currentQuery.trim() && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full px-4 py-3 text-sm text-left text-text-2 hover:text-text hover:bg-raised flex items-center gap-2 border-b border-raised"
          >
            <Plus className="size-4" />
            Save current search
          </button>
        )}

        {/* Save form */}
        {isAdding && (
          <div className="p-3 border-b border-raised space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Search name..."
              autoFocus
              className="w-full px-3 py-2 text-sm bg-page border border-muted rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent-fill focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setIsAdding(false)
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!newName.trim() || saveMutation.isPending}
                className="flex-1 px-3 py-2 text-sm font-medium bg-accent-fill hover:bg-accent-fill disabled:opacity-50 rounded-lg text-text transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 text-sm text-text-2 hover:text-text hover:bg-raised rounded-lg transition-colors"
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
                className="flex items-center justify-between px-4 py-3 hover:bg-raised cursor-pointer group transition-colors"
                onClick={() => {
                  onSelectSearch(search.query)
                  setOpen(false)
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {search.name}
                  </div>
                  <div className="text-xs text-text-2 truncate mt-0.5">
                    {search.query}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteMutation.mutate({ id: search.id })
                  }}
                  className="p-1.5 text-muted hover:text-accent opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-muted text-center">
            No saved searches yet
          </div>
        )}
      </PopoverPanel>
    </Popover>
  )
}
