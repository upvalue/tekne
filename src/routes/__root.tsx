import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { Toaster } from '@/components/vendor/Sonner'
import { DocumentSearch } from '@/controls/DocumentSearch'
import type { PanelTab } from '@/panel/state'

export type RouterAppContext = {
  trpc: typeof trpc
}

const RootComponent = () => {
  // Global keybinding for search panel (Cmd-/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        window.dispatchEvent(
          new CustomEvent<{ tab: PanelTab }>('tekne:panel-tab', {
            detail: { tab: 'search' },
          })
        )
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <DocumentSearch>
      <Outlet />
      <Toaster />
    </DocumentSearch>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
