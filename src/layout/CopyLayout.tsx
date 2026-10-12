import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CopyLayoutProps {
  statusCode?: string
  title: string
  subtitle?: string
  columns?: boolean
  primaryAction: {
    text: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    text: string
    href: string
  }
  thirdAction?: {
    text: string
    href: string
  }
  children?: ReactNode
}

export function CopyLayout({
  statusCode,
  title,
  subtitle,
  columns,
  primaryAction,
  secondaryAction,
  thirdAction,
  children,
}: CopyLayoutProps) {
  return (
    <>
      <main className="grid min-h-full place-items-center bg-text px-6 py-24 sm:py-32 lg:px-8 dark:bg-page">
        <div className="text-center">
          {statusCode && (
            <p className="text-base font-semibold text-accent-fill dark:text-accent">
              {statusCode}
            </p>
          )}
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-page sm:text-7xl dark:text-text">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-lg font-medium text-pretty text-muted sm:text-xl/8 dark:text-text-2">
              {subtitle}
            </p>
          )}
          {children && (
            <div className="mt-6 flex justify-center">{children}</div>
          )}
          <div
            className={cn(
              'mt-10 flex items-center justify-center gap-6',
              columns && 'flex-col'
            )}
          >
            {primaryAction.onClick ? (
              <button
                onClick={primaryAction.onClick}
                className="rounded-md cursor-pointer bg-accent px-3.5 py-2.5 text-sm font-semibold text-text shadow-xs hover:bg-accent-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fill dark:bg-accent-fill dark:hover:bg-accent dark:focus-visible:outline-accent-fill"
              >
                {primaryAction.text}
              </button>
            ) : (
              <a
                href={primaryAction.href}
                className="rounded-md cursor-pointer bg-accent px-3.5 py-2.5 text-sm font-semibold text-text shadow-xs hover:bg-accent-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fill dark:bg-accent-fill dark:hover:bg-accent dark:focus-visible:outline-accent-fill"
              >
                {primaryAction.text}
              </a>
            )}
            {secondaryAction && (
              <a
                href={secondaryAction.href}
                className="text-sm font-semibold text-page dark:text-text"
              >
                {secondaryAction.text} <span aria-hidden="true">&rarr;</span>
              </a>
            )}
            {thirdAction && (
              <a
                href={thirdAction.href}
                className="text-sm font-semibold text-page dark:text-text"
              >
                {thirdAction.text} <span aria-hidden="true">&rarr;</span>
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
