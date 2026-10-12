import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

export const LineGlyph = ({
  pinned,
  collapseStart = false,
  className,
}: {
  pinned: boolean
  collapseStart?: boolean
  className?: string
}) =>
  pinned ? (
    <Pin size={11} className={cn('text-muted', className)} />
  ) : (
    <span
      className={cn(
        'inline-block size-1 rounded-full bg-mark',
        collapseStart && 'ring-4 ring-white/9 bg-text-2',
        className
      )}
    />
  )
