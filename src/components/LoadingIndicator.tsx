import { LoaderCircle } from 'lucide-react'
import { useLoadingStyle, type LoadingStyle } from '@/lib/loading-style'

export function LoadingIndicator({
  label = 'Loading',
  variant,
}: {
  label?: string
  variant?: LoadingStyle
}) {
  const [selected] = useLoadingStyle()
  const style = variant ?? selected
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex h-5 min-w-5 items-center justify-center text-muted"
    >
      {style === 'spinner' ? (
        <LoaderCircle
          aria-hidden="true"
          size={14}
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <span aria-hidden="true" className={`Loading-${style}`}>
          <i />
          {style === 'dots' && (
            <>
              <i />
              <i />
            </>
          )}
        </span>
      )}
    </span>
  )
}
