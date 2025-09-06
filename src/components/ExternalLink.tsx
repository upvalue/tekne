import { LinkIcon } from '@heroicons/react/16/solid'
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
        className={cn(
          'text-sky-400 inline-flex items-center gap-1',
          className
        )}
      >
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
        <LinkIcon className="w-4 h-4 text-sky-400" />
      </div>
    </div>
  )
}
