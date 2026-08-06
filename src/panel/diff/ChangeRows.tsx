import { useEffect, useState } from 'react'
import type { DiffLine, ProposedLineChange } from '@/docs/doc-diff'
import { ReadOnlyLine } from '@/editor/ReadOnlyLine'

/** Each ReadOnlyLine is a CodeMirror instance -- cap the initial render */
const INITIAL_ROWS = 30

const DiffRow = ({ line, tone }: { line: DiffLine; tone: 'red' | 'green' }) => (
  <ReadOnlyLine
    content={line.mdContent}
    indent={line.indent}
    datumTaskStatus={line.datumTaskStatus}
    datumTimeSeconds={line.datumTimeSeconds}
    datumPinnedAt={line.datumPinnedAt}
    className={
      tone === 'red'
        ? 'border-l-2 border-red-500/50 bg-red-950/20'
        : 'border-l-2 border-green-500/50 bg-green-950/20'
    }
  />
)

/**
 * The shared body of every proposed-diff preview: one entry per changed
 * line, rendered as red (before) / green (after) rows. Shells around it
 * (tag-rename's document pager, the agent panel's live view) differ per
 * feature; the rows do not.
 */
export const ChangeRows = ({ changes }: { changes: ProposedLineChange[] }) => {
  const [showAll, setShowAll] = useState(false)

  // A new proposal resets the cap
  useEffect(() => {
    setShowAll(false)
  }, [changes])

  const visible = showAll ? changes : changes.slice(0, INITIAL_ROWS)
  const hiddenCount = changes.length - visible.length

  return (
    <div className="divide-y divide-zinc-800/60">
      {visible.map((change, idx) => (
        <div key={idx} className="px-2 py-1">
          {'before' in change && <DiffRow line={change.before} tone="red" />}
          {'after' in change && <DiffRow line={change.after} tone="green" />}
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="w-full px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more change{hiddenCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}
