import { DocumentDetails } from '@/editor/DocumentDetails'
import { useDocTitle } from '@/hooks/useDocTitle'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export const DocumentOverviewSection = ({
  label,
  children,
  flush = false,
}: {
  label: string
  children: React.ReactNode
  flush?: boolean
}) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn('flex flex-col gap-2 pb-3 pt-1', !flush && 'px-3')}>
      <h2 className={flush ? 'px-3' : undefined}>
        <button
          type="button"
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 rounded px-0 py-1 text-left text-xs font-semibold text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-2 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          {label}
        </button>
      </h2>
      <div className={`${collapsed ? 'hidden' : ''}`}>{children}</div>
    </div>
  )
}

export const DocumentOverview = () => {
  const title = useDocTitle()
  return (
    <div className="flex flex-1 flex-col">
      {title && (
        <footer aria-label="Document details" className="mt-auto px-3 pt-3">
          <DocumentDetails title={title} />
        </footer>
      )}
    </div>
  )
}
