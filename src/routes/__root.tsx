import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useSetAtom } from 'jotai'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'
import { trpc } from '@/trpc/client'
import { Toaster } from '@/components/vendor/Sonner'
import { DocumentSearch } from '@/controls/DocumentSearch'
import { TemplateDialog } from '@/controls/TemplateDialog'
import { activePanelTabAtom, panelVisibleAtom } from '@/hooks/panel-state'
// Registers all commands with the editor's command registry.
import '@/commands/definitions'

export type RouterAppContext = {
  trpc: typeof trpc
}

const RootComponent = () => {
  const setPanelVisible = useSetAtom(panelVisibleAtom)
  const setActiveTab = useSetAtom(activePanelTabAtom)

  useGlobalKeybinding('searchPanel', () => {
    setPanelVisible(true)
    setActiveTab('search')
  })

  useGlobalKeybinding('togglePanel', () => setPanelVisible((v) => !v))

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
