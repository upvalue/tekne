import { AlertCircle } from 'lucide-react'
import { LoadingIndicator } from './LoadingIndicator'
import { Button } from './vendor/Button'

export function ErrorState({
  title = 'Something went wrong',
  message = 'Try again to reload this view.',
  detail,
  onRetry,
  busy = false,
}: {
  title?: string
  message?: string
  detail?: string
  onRetry?: () => void
  busy?: boolean
}) {
  return (
    <section
      role="alert"
      className="ErrorState m-3 rounded-lg bg-raised/40 p-3 text-sm text-text-2"
    >
      <div className="flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-2" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-text">{title}</h2>
          <p className="mt-1 leading-5">{message}</p>
          {onRetry && (
            <Button className="mt-2" onClick={onRetry} disabled={busy}>
              {busy ? <LoadingIndicator label="Retrying" /> : 'Try again'}
            </Button>
          )}
          {detail && (
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer hover:text-text">
                Error details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans">
                {detail}
              </pre>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}
