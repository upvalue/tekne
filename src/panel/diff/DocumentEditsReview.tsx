import { useEffect, useMemo, useState } from 'react'
import { Checkbox } from '@/components/vendor/Checkbox'
import type { ProposedDocumentEdits } from '@/docs/doc-diff'
import { cn } from '@/lib/utils'
import { ChangeRows } from './ChangeRows'

export const DocumentEditsReview = ({
  documents,
  selectedTitles,
  onSelectedTitlesChange,
}: {
  documents: ProposedDocumentEdits[]
  /** Supplying both selection props makes the document list selectable. */
  selectedTitles?: ReadonlySet<string>
  onSelectedTitlesChange?: (titles: Set<string>) => void
}) => {
  const [focusedTitle, setFocusedTitle] = useState<string | null>(null)
  const selectable =
    selectedTitles !== undefined && onSelectedTitlesChange !== undefined

  useEffect(() => {
    setFocusedTitle((current) =>
      current && documents.some((doc) => doc.title === current)
        ? current
        : (documents[0]?.title ?? null)
    )
  }, [documents])

  const focusedDocument = useMemo(
    () =>
      documents.find((doc) => doc.title === focusedTitle) ??
      documents[0] ??
      null,
    [documents, focusedTitle]
  )

  const setSelected = (title: string, selected: boolean) => {
    if (!selectable) return
    const next = new Set(selectedTitles)
    if (selected) next.add(title)
    else next.delete(title)
    onSelectedTitlesChange(next)
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-raised text-sm text-muted">
        No changes to review
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(11rem,0.8fr)_minmax(0,2fr)] overflow-hidden rounded-lg border border-raised">
      <div className="flex min-h-0 flex-col border-r border-raised bg-page/30">
        {selectable && (
          <div className="flex items-center gap-2 border-b border-raised px-2 py-1.5 text-xs">
            <button
              type="button"
              className="text-text-2 hover:text-text"
              onClick={() =>
                onSelectedTitlesChange(
                  new Set(documents.map((document) => document.title))
                )
              }
            >
              Select all
            </button>
            <span className="text-raised">·</span>
            <button
              type="button"
              className="text-text-2 hover:text-text"
              onClick={() => onSelectedTitlesChange(new Set())}
            >
              Select none
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {documents.map((document) => {
            const selected = !selectable || selectedTitles.has(document.title)
            const focused = document.title === focusedDocument?.title
            return (
              <div
                key={document.title}
                className={cn(
                  'flex items-center gap-2 border-b border-raised/60 px-2 py-1.5',
                  focused && 'bg-raised/70',
                  !selected && 'opacity-50'
                )}
              >
                {selectable && (
                  <Checkbox
                    aria-label={`Include ${document.title}`}
                    checked={selected}
                    onCheckedChange={(checked) =>
                      setSelected(document.title, checked)
                    }
                  />
                )}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setFocusedTitle(document.title)}
                >
                  <span className="block truncate text-sm text-text">
                    {document.title}
                  </span>
                  <span className="text-xs text-muted">
                    {document.changes.length} change
                    {document.changes.length === 1 ? '' : 's'}
                  </span>
                </button>
                {document.isTemplate && (
                  <span className="rounded bg-accent-tint/60 px-1.5 py-0.5 text-[10px] text-accent">
                    template
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="border-b border-raised bg-page/60 px-3 py-1.5">
          <div className="truncate text-sm font-medium text-text">
            {focusedDocument?.title}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {focusedDocument && <ChangeRows changes={focusedDocument.changes} />}
        </div>
      </div>
    </div>
  )
}
