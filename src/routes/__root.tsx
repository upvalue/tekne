import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { trpc } from '@/trpc/client'
import { Toaster } from '@/components/vendor/Sonner'
import { DocumentSearch } from '@/controls/DocumentSearch'
import { TemplateDialog } from '@/controls/TemplateDialog'
import { activePanelTabAtom, panelVisibleAtom } from '@/panel/state'

export type RouterAppContext = {
  trpc: typeof trpc
}

const RootComponent = () => {
  const setPanelVisible = useSetAtom(panelVisibleAtom)
  const setActiveTab = useSetAtom(activePanelTabAtom)

  // Global keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+/ — open search panel (also ensures panel is visible)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setPanelVisible(true)
        setActiveTab('search')
      }
      // Cmd/Ctrl+\ — toggle panel visibility
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setPanelVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setPanelVisible, setActiveTab])

  return (
    <DocumentSearch>
      <Outlet />
      <Toaster />
      <TemplateDialog />
    </DocumentSearch>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
