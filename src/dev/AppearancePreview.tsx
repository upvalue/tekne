import { useLoadingStyle, type LoadingStyle } from '@/lib/loading-style'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/ErrorState'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import { Button } from '@/components/vendor/Button'
import { SaveConflictDialog } from '@/editor/SaveConflictDialog'
import { useWritingPrompt, WRITING_PROMPTS } from '@/hooks/writing-prompt'

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
  const [loadingStyle, setLoadingStyle] = useLoadingStyle()
  const [prompt, setPrompt] = useWritingPrompt()
  return (
    <div className="space-y-5 text-sm">
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
          <Button
            onClick={() =>
              toast.error('Could not save changes', {
                id: 'error-preview',
                description:
                  'Your edits are still in this tab. Check your connection and retry.',
                duration: Infinity,
                closeButton: true,
                action: {
                  label: 'Retry',
                  onClick: () => toast.dismiss('error-preview'),
                },
              })
            }
          >
            Preview error toast
          </Button>
          <Button onClick={() => setConflict(true)}>
            Preview save conflict
          </Button>
        </div>
        <SaveConflictDialog
          open={conflict}
          onResolve={() => setConflict(false)}
        />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Loading</h2>
        <div className="flex flex-wrap gap-2">
          {(['spinner', 'dots', 'pulse'] as LoadingStyle[]).map((variant) => (
            <button
              key={variant}
              onClick={() => setLoadingStyle(variant)}
              aria-pressed={loadingStyle === variant}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${loadingStyle === variant ? 'bg-accent-tint text-accent' : 'bg-raised text-muted'}`}
            >
              <LoadingIndicator
                variant={variant}
                label={`${variant} preview`}
              />
              {variant}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Writing prompt</h2>
        <p className="text-xs text-muted">
          Choose a static mark to try in empty lines.
        </p>
        <div className="flex flex-wrap gap-2">
          {WRITING_PROMPTS.map((mark, index) => (
            <button
              key={mark}
              aria-label={`Writing prompt variant ${index + 1}`}
              aria-pressed={prompt === index}
              onClick={() => setPrompt(index)}
              className={`rounded px-2 py-1 text-lg ${prompt === index ? 'bg-accent-tint text-accent' : 'bg-raised text-muted'}`}
            >
              {mark}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
