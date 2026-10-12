import { useState } from 'react'
import { ErrorScratchpadPreview } from './ErrorScratchpadPreview'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/vendor/Button'
import { SaveConflictDialog } from '@/editor/SaveConflictDialog'

const SAMPLES = {
  load: {
    title: 'Could not load this document',
    message: 'Check your connection and try again.',
    detail: 'The request timed out.',
  },
  search: {
    title: 'Search unavailable',
    message: 'Your query is still here. Try the search again.',
    detail: 'The search service could not be reached.',
  },
  crash: {
    title: 'Panel could not be displayed',
    message: 'Try loading this view again.',
    detail: 'An unexpected error occurred while rendering the panel.',
  },
  long: {
    title: 'Could not save changes',
    message:
      'Your edits are still in this tab. Reconnect before leaving the page.',
    detail: 'Request failed: '.repeat(30),
  },
}

export function AppearancePreview() {
  const [sample, setSample] = useState<keyof typeof SAMPLES>('load')
  const [conflict, setConflict] = useState(false)
  const [retried, setRetried] = useState(false)
  return (
    <div className="space-y-5 text-sm">
      <ErrorScratchpadPreview />
      <section className="space-y-2">
        <h2 className="font-medium">Error previews</h2>
        <p className="text-xs text-muted">
          Sample errors using the app’s error components. Retry and conflict
          choices only dismiss the preview.
        </p>
        <label className="block text-xs text-text-2">
          Error type
          <select
            value={sample}
            onChange={(event) => {
              setSample(event.target.value as keyof typeof SAMPLES)
              setRetried(false)
            }}
            className="mt-1 w-full rounded bg-raised px-2 py-1.5 text-sm"
          >
            <option value="load">Document loading</option>
            <option value="search">Search</option>
            <option value="crash">Crashed panel</option>
            <option value="long">Long error message</option>
          </select>
        </label>
        {retried ? (
          <div role="status" className="p-3 text-muted">
            Preview dismissed.{' '}
            <button className="text-accent" onClick={() => setRetried(false)}>
              Show again
            </button>
          </div>
        ) : (
          <ErrorState {...SAMPLES[sample]} onRetry={() => setRetried(true)} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConflict(true)}>
            Preview save conflict
          </Button>
        </div>
        <SaveConflictDialog
          open={conflict}
          onResolve={() => setConflict(false)}
        />
      </section>
    </div>
  )
}
