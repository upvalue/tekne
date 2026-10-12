// KBar.tsx - display related KBar stuff (actual implementation stuff is part of
// document search and command palette)
import React from 'react'
import {
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
} from 'kbar'

import './kbar.css'
import { cn } from '@/lib/utils'

export const KBarResultRenderer = () => {
  const { results } = useMatches()

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="p-2 text-sm text-muted uppercase font-medium">
            {item}
          </div>
        ) : (
          <div className={`p-1 cursor-pointer`}>
            <div className={cn('p-2 rounded-md', active && 'bg-page')}>
              <div className="font-medium">{item.name}</div>
              {item.subtitle && (
                <div className="text-sm text-muted">{item.subtitle}</div>
              )}
            </div>
          </div>
        )
      }
    />
  )
}

export const KBarSearchInput: React.FC<{ placeholder: string }> = ({
  placeholder,
}) => {
  return (
    <KBarSearch
      className="w-full px-4 py-3 text-lg border-none outline-none"
      defaultPlaceholder={placeholder}
    />
  )
}

export const KBarModal: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <KBarPortal>
      <KBarPositioner className="KBarModal-positioner fixed inset-0 z-50 flex items-start justify-center">
        <KBarAnimator className="w-full max-w-xl">
          <div className="KBarModal-container p-2 rounded-lg shadow-xl overflow-hidden text-text">
            {children}
          </div>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  )
}
