// Saved-searches dropdown for the search panel: list, apply, save the
// current query, delete. Built on the Headless UI popover so outside-click,
// Escape, and focus handling come from the kit instead of a hand-rolled
// document listener.
import { useState } from 'react'
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@/components/vendor/Popover'
import { Bookmark, Trash2, Plus, ChevronDown } from 'lucide-react'
import { trpc } from '@/trpc/client'
import { cn } from '@/lib/utils'

export const SavedSearches = ({
  currentQuery,
  onSelectSearch,
}: {
  currentQuery: string
  onSelectSearch: (query: string) => void
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

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

  const handleSave = () => {
    if (newName.trim() && currentQuery.trim()) {
      saveMutation.mutate({ name: newName.trim(), query: currentQuery })
    }
  }

  const count = savedSearches?.length || 0

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all w-full focus:outline-none',
              open
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'
            )}
          >
            <Bookmark className="size-4" />
            <span className="flex-1 text-left">
              {count > 0 ? `Saved Searches (${count})` : 'Saved Searches'}
            </span>
            <ChevronDown
              className={cn(
                'size-4 transition-transform text-zinc-400',
                open && 'rotate-180'
              )}
            />
          </PopoverButton>

          <PopoverPanel className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-600 rounded-xl shadow-xl z-10 max-h-72 overflow-auto">
            {({ close }) => (
              <>
                {/* Save current search option */}
                {currentQuery.trim() && !isAdding && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full px-4 py-3 text-sm text-left text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 flex items-center gap-2 border-b border-zinc-700"
                  >
                    <Plus className="size-4" />
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
                        onClick={() => {
                          onSelectSearch(search.query)
                          close()
                        }}
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
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-zinc-500 text-center">
                    No saved searches yet
                  </div>
                )}
              </>
            )}
          </PopoverPanel>
        </>
      )}
    </Popover>
  )
}
