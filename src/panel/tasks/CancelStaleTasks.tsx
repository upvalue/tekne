import { useMemo, useState } from 'react'
import { CalendarX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/vendor/Button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/vendor/Dialog'
import { Input } from '@/components/vendor/Input'
import { EditorDialogContent } from '@/components/EditorDialogContent'
import { DocumentEditsReview } from '@/panel/diff/DocumentEditsReview'
import { trpc } from '@/trpc/client'
import { localDateCutoff } from './date-cutoff'

export const CancelStaleTasks = () => {
  const [date, setDate] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set())
  const propose = trpc.tasks.cancelStalePropose.useMutation()
  const execute = trpc.tasks.cancelStaleExecute.useMutation()
  const cutoff = localDateCutoff(date)
  const proposal = propose.data

  const selectedDocuments = useMemo(
    () =>
      proposal?.documents.filter((document) =>
        selectedTitles.has(document.title)
      ) ?? [],
    [proposal, selectedTitles]
  )
  const selectedChanges = selectedDocuments.reduce(
    (total, document) => total + document.changes.length,
    0
  )

  const preview = async () => {
    if (!cutoff) return
    try {
      const result = await propose.mutateAsync({ cutoff })
      setSelectedTitles(
        new Set(result.documents.map((document) => document.title))
      )
      setReviewOpen(true)
    } catch (error) {
      toast.error(`Failed to find stale checkboxes: ${String(error)}`)
    }
  }

  const apply = async () => {
    if (!cutoff || selectedDocuments.length === 0) return
    try {
      await execute.mutateAsync({
        cutoff,
        documents: selectedDocuments.map((document) => ({
          title: document.title,
          expectedRevision: document.revision,
        })),
      })
      window.location.reload()
    } catch (error) {
      toast.error(`Failed to cancel stale checkboxes: ${String(error)}`)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex items-start gap-3">
          <CalendarX className="mt-0.5 size-4 shrink-0 text-zinc-500" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                Cancel old checkboxes
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Find unchecked tasks created before a date. Templates are left
                out.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-xs text-zinc-400">
                Older than
                <Input
                  className="mt-1"
                  type="date"
                  aria-label="Cancel checkboxes older than"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <Button
                outline
                disabled={!cutoff || propose.isPending}
                onClick={preview}
              >
                {propose.isPending ? 'Finding…' : 'Preview'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <EditorDialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cancel old checkboxes</DialogTitle>
            <DialogDescription>
              Review the affected documents. Uncheck any document you do not
              want to change.
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[52vh] min-h-0 flex-col">
            <div className="pb-2 text-xs text-zinc-500">
              {proposal
                ? `${proposal.totalChanges} unchecked task${proposal.totalChanges === 1 ? '' : 's'} across ${proposal.documents.length} document${proposal.documents.length === 1 ? '' : 's'}`
                : 'Computing changes…'}
            </div>
            <div className="min-h-0 flex-1">
              <DocumentEditsReview
                documents={proposal?.documents ?? []}
                selectedTitles={selectedTitles}
                onSelectedTitlesChange={setSelectedTitles}
              />
            </div>
          </div>

          <DialogFooter>
            <Button plain onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              color="green"
              disabled={selectedDocuments.length === 0 || execute.isPending}
              onClick={apply}
            >
              {execute.isPending
                ? 'Applying…'
                : `Cancel ${selectedChanges} task${selectedChanges === 1 ? '' : 's'} in ${selectedDocuments.length} document${selectedDocuments.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </EditorDialogContent>
      </Dialog>
    </>
  )
}
