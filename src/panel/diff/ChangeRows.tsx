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
        ? 'border-l-2 border-accent-fill/50 bg-accent-tint/20'
        : 'border-l-2 border-accent-fill/50 bg-accent-tint/20'
    }
  />
)

/** Changed lines as before/after rows, shared by all edit previews. */
export const ChangeRows = ({ changes }: { changes: ProposedLineChange[] }) => {
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setShowAll(false)
  }, [changes])

  const visible = showAll ? changes : changes.slice(0, INITIAL_ROWS)
  const hiddenCount = changes.length - visible.length

  return (
    <div className="divide-y divide-raised/60">
      {visible.map((change, idx) => (
        <div key={idx} className="px-2 py-1">
          {'before' in change && <DiffRow line={change.before} tone="red" />}
          {'after' in change && <DiffRow line={change.after} tone="green" />}
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="w-full px-3 py-1.5 text-xs text-text-2 hover:bg-page hover:text-text"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more change{hiddenCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}
