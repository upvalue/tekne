import { useEventListener } from '@/hooks/useEventListener'
import type { QueryClient } from '@tanstack/react-query'
import { HelpDialog } from '@/panel/Help'
import { TimerObserver } from '@/editor/timer/TimerObserver'
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
} from '@tanstack/react-router'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'
import { orpc } from '@/api/client'
import { Toaster } from '@/components/vendor/Sonner'
import { TemplateDialog } from '@/controls/TemplateDialog'
import { openPanelTab, useSetPanelVisible } from '@/hooks/panel-state'
// Registers all commands with the editor's command registry.
import '@/commands/definitions'

export type RouterAppContext = {
  orpc: typeof orpc
  queryClient: QueryClient
}

const RootComponent = () => {
  const navigate = useNavigate()
  useEventListener('tekne:navigate-document', ({ detail }) => {
    void navigate({
      to: '/n/$title',
      params: { title: detail.title },
      hash: detail.lineId ? `line-${detail.lineId}` : '',
    })
  })
  const setPanelVisible = useSetPanelVisible()

  useGlobalKeybinding('searchPanel', () => openPanelTab('search'))

  useGlobalKeybinding('togglePanel', () => setPanelVisible((v) => !v))

  return (
    <>
      <TimerObserver />
      <Outlet />
      <Toaster />
      <TemplateDialog />
      <HelpDialog />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
