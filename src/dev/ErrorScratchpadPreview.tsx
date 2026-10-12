import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/vendor/Button'

type Entry = { id: number; at: string; message: string }

export function ErrorScratchpadPreview() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [current, setCurrent] = useState<Entry | null>(null)
  const [expanded, setExpanded] = useState(false)
  const sequence = useRef(0)

  useEffect(() => {
    if (!current) return
    const timeout = setTimeout(() => setCurrent(null), 5000)
    return () => clearTimeout(timeout)
  }, [current])

  const report = (message: string) => {
    const entry = {
      id: ++sequence.current,
      at: new Date().toISOString(),
      message,
    }
    setEntries((previous) => [entry, ...previous].slice(0, 50))
    setCurrent(entry)
  }

  return (
    <section className="space-y-3 rounded-xl border border-white/7 bg-page/40 p-4">
      <div>
        <h2 className="font-medium">
          Error scratch pad{' '}
          <span className="text-xs text-muted">Prototype</span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          An error stays on the status line for five seconds. History keeps the
          latest 50 sample errors while this preview is open. App errors still
          use the existing notifications.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          outline
          onClick={() =>
            report('Could not save changes. Your edits are still in this tab.')
          }
        >
          Simulate save error
        </Button>
        <Button
          outline
          onClick={() =>
            report(
              'Search unavailable. Try again when your connection returns.'
            )
          }
        >
          Simulate search error
        </Button>
      </div>
      <div className="flex min-h-10 items-center gap-3 border-y border-white/7 py-2">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 flex-1 text-sm text-text-2"
        >
          {current?.message}
        </div>
        {current && (
          <button
            className="text-xs text-muted hover:text-text"
            onClick={() => setCurrent(null)}
          >
            Dismiss
          </button>
        )}
        <button
          className="shrink-0 text-xs text-accent"
          aria-expanded={expanded}
          aria-controls="error-preview-history"
          onClick={() => setExpanded((value) => !value)}
        >
          History ({entries.length})
        </button>
      </div>
      {expanded && (
        <div id="error-preview-history" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-text-2">Recent errors</h3>
            <button
              disabled={!entries.length}
              className="text-xs text-muted enabled:hover:text-text disabled:opacity-50"
              onClick={() => {
                setEntries([])
                setCurrent(null)
              }}
            >
              Clear history
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="text-xs text-muted">No errors recorded.</p>
          ) : (
            <ol className="max-h-60 space-y-2 overflow-auto">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-white/3 p-3">
                  <time dateTime={entry.at} className="text-xs text-muted">
                    {new Date(entry.at).toLocaleTimeString()}
                  </time>
                  <p className="mt-1 text-sm">{entry.message}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
