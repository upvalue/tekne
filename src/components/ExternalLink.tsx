import { Link as LinkGlyph } from 'lucide-react'
import { cn } from '@/lib/utils'

export const ExternalLink = ({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div className="inline">
      <div
        className={cn('text-accent inline-flex items-center gap-1', className)}
      >
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
        <LinkGlyph className="w-4 h-4 text-accent" />
      </div>
    </div>
  )
}
