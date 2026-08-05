import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { trpc } from '@/trpc/client'
import { tagNameSchema } from '@/docs/validation'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/vendor/Dialog'
import { EditorDialogContent } from '@/components/EditorDialogContent'
import { Button } from '@/components/vendor/Button'
import { Input } from '@/components/vendor/Input'
import { Checkbox } from '@/components/vendor/Checkbox'
import { TagRenameDiff } from './TagRenameDiff'

const PROPOSE_DEBOUNCE_MS = 400

/**
 * Asks the editor route (if mounted) to flush any unsaved document changes,
 * so a server-side rewrite starts from current content. Resolves via the
 * listener's callback, with a timeout fallback when no editor is mounted.
 */
const flushPendingSave = () =>
  new Promise<void>((resolve) => {
    const fallback = setTimeout(resolve, 1500)
    window.dispatchEvent(
      new CustomEvent('tekne:request-save', {
        detail: {
          onComplete: () => {
            clearTimeout(fallback)
            resolve()
          },
        },
      })
    )
  })

/**
 * Rename/merge dialog for a tag. Shows a live diff of every line across all
 * documents that the operation would rewrite; committing flushes the open
 * editor, executes server-side, then reloads the page so every cache
 * (document, tags, aggregates, search) starts fresh.
 */
export const TagRenameDialog = ({
  tag,
  onClose,
}: {
  /** Tag being renamed (no '#'), or null when the dialog is closed */
  tag: string | null
  onClose: () => void
}) => {
  const [newName, setNewName] = useState('')
  const [includeChildren, setIncludeChildren] = useState(false)

  const propose = trpc.tags.renamePropose.useMutation()
  const execute = trpc.tags.renameExecute.useMutation()

  const validation = tagNameSchema.safeParse(newName)
  const nameError =
    newName.length > 0 && !validation.success
      ? (validation.error.issues[0]?.message ?? 'Invalid tag name')
      : newName === tag
        ? 'New name is the same as the current name'
        : null
  const inputReady = tag !== null && newName.length > 0 && nameError === null

  const proposeMutate = propose.mutate
  const proposeReset = propose.reset

  useEffect(() => {
    setNewName('')
    setIncludeChildren(false)
    proposeReset()
  }, [tag, proposeReset])

  useEffect(() => {
    if (!inputReady || tag === null) {
      proposeReset()
      return
    }
    const timer = setTimeout(() => {
      proposeMutate({ oldName: tag, newName, includeChildren })
    }, PROPOSE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [tag, newName, includeChildren, inputReady, proposeMutate, proposeReset])

  const proposal = propose.data
  const isMerge = proposal?.targetExists ?? false

  const onConfirm = async () => {
    if (!inputReady || tag === null) {
      return
    }
    await flushPendingSave()
    try {
      await execute.mutateAsync({ oldName: tag, newName, includeChildren })
      // A full reload is the simplest way to refresh every cache the rename
      // touches (open document, tag lists, aggregates, search results).
      window.location.reload()
    } catch (e) {
      toast.error(`Failed to ${isMerge ? 'merge' : 'rename'} tag: ${String(e)}`)
    }
  }

  return (
    <Dialog open={tag !== null} onOpenChange={(open) => !open && onClose()}>
      <EditorDialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rename #{tag}</DialogTitle>
          <DialogDescription>
            Renames the tag across all documents. A preview of every change is
            shown before anything is committed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            aria-label="New tag name"
            placeholder="new-tag-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          {nameError && <div className="text-xs text-red-400">{nameError}</div>}

          {isMerge && (
            <div className="rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              #{newName} already exists — this will <b>merge</b> #{tag} into #
              {newName}. Lines carrying both tags keep a single #{newName}.
            </div>
          )}

          {proposal && proposal.childTags.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <Checkbox
                checked={includeChildren}
                onChange={(checked) => setIncludeChildren(checked)}
              />
              Also rename {proposal.childTags.length} child tag
              {proposal.childTags.length === 1 ? '' : 's'} (
              {proposal.childTags
                .slice(0, 3)
                .map((t) => `#${t}`)
                .join(', ')}
              {proposal.childTags.length > 3 ? ', …' : ''})
            </label>
          )}

          {/* Fixed height so the dialog doesn't resize while cycling docs
              or re-proposing */}
          {(propose.isPending || proposal) && (
            <div className="flex h-[45vh] flex-col">
              <div className="pb-2 text-xs text-zinc-500">
                {propose.isPending || !proposal
                  ? 'Computing changes…'
                  : `${proposal.totalLines} line${proposal.totalLines === 1 ? '' : 's'} across ${proposal.docs.length} document${proposal.docs.length === 1 ? '' : 's'}`}
              </div>
              <div className="min-h-0 flex-1">
                {proposal && <TagRenameDiff proposal={proposal} />}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button plain onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              !inputReady ||
              propose.isPending ||
              !proposal ||
              proposal.totalLines === 0 ||
              execute.isPending
            }
          >
            {execute.isPending
              ? 'Applying…'
              : isMerge
                ? `Merge into #${newName}`
                : 'Rename'}
          </Button>
        </DialogFooter>
      </EditorDialogContent>
    </Dialog>
  )
}
