import React from 'react'

interface DocsWrapperProps {
  children: React.ReactNode
}

export function DocsWrapper({ children }: DocsWrapperProps) {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none p-4">
      {children}
    </div>
  )
}
