import { useEffect, useRef, useState } from 'react'
import { Tag, Pencil, Archive, ArchiveRestore, Replace } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { trpc } from '@/trpc/client'
import { cn } from '@/lib/utils'

/**
 * A single tag in the Tools panel: name, stats, editable description and a
 * rename/merge entry point. `name` is without the leading '#'.
 */
export const TagCard = ({
  name,
  description,
  archived,
  stats,
  highlighted,
  onRename,
}: {
  name: string
  description: string | null
  archived?: boolean
  stats: React.ReactNode
  highlighted?: boolean
  onRename: (name: string) => void
}) => {
  const utils = trpc.useUtils()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const setDescription = trpc.tags.setDescription.useMutation({
    onSuccess: () => {
      utils.tags.list.invalidate()
    },
    onError: (e) => {
      toast.error(`Failed to save description: ${e.message}`)
    },
  })

  const setArchived = trpc.tags.setArchived.useMutation({
    onSuccess: (_data, variables) => {
      utils.tags.list.invalidate()
      // Autocomplete reads this through its own Jotai-backed query
      queryClient.invalidateQueries({ queryKey: ['allTags'] })
      toast.success(
        variables.archived ? `Archived #${name}` : `Restored #${name}`
      )
    },
    onError: (e) => {
      toast.error(`Failed to archive tag: ${e.message}`)
    },
  })

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [highlighted])

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
    }
  }, [editing])

  const startEditing = () => {
    setDraft(description ?? '')
    setEditing(true)
  }

  const saveDescription = () => {
    setEditing(false)
    if (draft.trim() === (description ?? '')) {
      return
    }
    setDescription.mutate({ name, description: draft })
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        'group rounded-lg border border-zinc-800 bg-zinc-900/40 p-3',
        highlighted && 'border-amber-500/60',
        archived && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2">
        <Tag className="size-4 text-zinc-500" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium',
            archived ? 'text-zinc-400' : 'text-zinc-100'
          )}
        >
          #{name}
        </span>
        {archived && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            Archived
          </span>
        )}
        <button
          type="button"
          title={archived ? 'Restore tag' : 'Archive tag'}
          className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100"
          disabled={setArchived.isPending}
          onClick={() => setArchived.mutate({ name, archived: !archived })}
        >
          {archived ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
        </button>
        <button
          type="button"
          title="Edit description"
          className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100"
          onClick={startEditing}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          title="Rename or merge tag"
          className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100"
          onClick={() => onRename(name)}
        >
          <Replace className="size-4" />
        </button>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          className="mt-2 w-full resize-none rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1.5 text-xs leading-relaxed text-zinc-200 shadow-inner placeholder:text-zinc-500 focus:border-zinc-500/80 focus:bg-zinc-800/80 focus:ring-1 focus:ring-zinc-500/40 focus:outline-none"
          rows={2}
          placeholder="Describe this tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              saveDescription()
            }
            if (e.key === 'Escape') {
              setEditing(false)
            }
          }}
        />
      ) : (
        description && (
          <div className="mt-2 text-xs text-zinc-400">{description}</div>
        )
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
        {stats}
      </div>
    </div>
  )
}
