import { LoaderCircle } from 'lucide-react'

export function LoadingIndicator({ label = 'Loading' }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex h-5 min-w-5 items-center justify-center text-muted"
    >
      <LoaderCircle aria-hidden="true" size={14} className="animate-spin" />
    </span>
  )
}
