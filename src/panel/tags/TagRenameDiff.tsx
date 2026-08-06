import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { RouterOutputs } from '@/trpc/types'
import type { ProposedLineChange } from '@/docs/doc-diff'
import { ChangeRows } from '@/panel/diff/ChangeRows'

type Proposal = RouterOutputs['tags']['renamePropose']

/** A tag rename only ever rewrites lines in place -- every row is 'changed'. */
const toChanges = (doc: Proposal['docs'][number]): ProposedLineChange[] =>
  doc.lines.map((line) => ({
    kind: 'changed',
    before: {
      mdContent: line.before,
      indent: line.indent,
      datumTaskStatus: line.datumTaskStatus,
      datumTimeSeconds: line.datumTimeSeconds,
      datumPinnedAt: line.datumPinnedAt,
    },
    after: {
      mdContent: line.after,
      indent: line.indent,
      datumTaskStatus: line.datumTaskStatus,
      datumTimeSeconds: line.datumTimeSeconds,
      datumPinnedAt: line.datumPinnedAt,
    },
  }))

/**
 * Before/after preview of the lines a tag rename/merge would change, one
 * document at a time. The pager keeps the dialog a constant size no matter
 * how many documents or lines are affected; the line list scrolls within.
 */
export const TagRenameDiff = ({ proposal }: { proposal: Proposal }) => {
  const [docIdx, setDocIdx] = useState(0)
  const docs = proposal.docs

  // A new proposal (name/checkbox change) invalidates the current position
  useEffect(() => {
    setDocIdx(0)
  }, [docs])

  const doc = docs.length > 0 ? docs[Math.min(docIdx, docs.length - 1)] : null
  const changes = useMemo(() => (doc ? toChanges(doc) : []), [doc])

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 text-sm text-zinc-500">
        No occurrences to rewrite
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
        <button
          type="button"
          title="Previous document"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={docIdx === 0}
          onClick={() => setDocIdx(docIdx - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-zinc-200">
          {doc.title}
        </span>
        {doc.isTemplate && (
          <span className="rounded bg-purple-950/60 px-1.5 py-0.5 text-xs text-purple-300">
            template
          </span>
        )}
        <span className="whitespace-nowrap text-xs text-zinc-500">
          {doc.lines.length} line{doc.lines.length === 1 ? '' : 's'}
          {docs.length > 1 && ` · ${docIdx + 1}/${docs.length}`}
        </span>
        <button
          type="button"
          title="Next document"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={docIdx >= docs.length - 1}
          onClick={() => setDocIdx(docIdx + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChangeRows changes={changes} />
      </div>
    </div>
  )
}
