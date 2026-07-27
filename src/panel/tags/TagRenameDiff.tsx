import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import type { RouterOutputs } from '@/trpc/types'
import { ReadOnlyLine } from '@/editor/ReadOnlyLine'

type Proposal = RouterOutputs['tags']['renamePropose']

/** Each ReadOnlyLine is a CodeMirror instance -- cap the initial render */
const INITIAL_LINES_PER_DOC = 30

/**
 * Before/after preview of the lines a tag rename/merge would change, one
 * document at a time. The pager keeps the dialog a constant size no matter
 * how many documents or lines are affected; the line list scrolls within.
 */
export const TagRenameDiff = ({ proposal }: { proposal: Proposal }) => {
  const [docIdx, setDocIdx] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const docs = proposal.docs

  // A new proposal (name/checkbox change) invalidates the current position
  useEffect(() => {
    setDocIdx(0)
    setShowAll(false)
  }, [docs])

  if (docs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 text-sm text-zinc-500">
        No occurrences to rewrite
      </div>
    )
  }

  const doc = docs[Math.min(docIdx, docs.length - 1)]
  const lines = showAll ? doc.lines : doc.lines.slice(0, INITIAL_LINES_PER_DOC)
  const hiddenCount = doc.lines.length - lines.length

  const selectDoc = (idx: number) => {
    setDocIdx(idx)
    setShowAll(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
        <button
          type="button"
          title="Previous document"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
          disabled={docIdx === 0}
          onClick={() => selectDoc(docIdx - 1)}
        >
          <ChevronLeftIcon className="size-4" />
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
          onClick={() => selectDoc(docIdx + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      <div className="flex-1 divide-y divide-zinc-800/60 overflow-y-auto">
        {lines.map((line) => (
          <div key={line.lineIdx} className="px-2 py-1">
            <ReadOnlyLine
              content={line.before}
              indent={line.indent}
              datumTaskStatus={line.datumTaskStatus}
              datumTimeSeconds={line.datumTimeSeconds}
              datumPinnedAt={line.datumPinnedAt}
              className="border-l-2 border-red-500/50 bg-red-950/20"
            />
            <ReadOnlyLine
              content={line.after}
              indent={line.indent}
              datumTaskStatus={line.datumTaskStatus}
              datumTimeSeconds={line.datumTimeSeconds}
              datumPinnedAt={line.datumPinnedAt}
              className="border-l-2 border-green-500/50 bg-green-950/20"
            />
          </div>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            className="w-full px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            onClick={() => setShowAll(true)}
          >
            Show {hiddenCount} more line{hiddenCount === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </div>
  )
}
