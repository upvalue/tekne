import { TimerObserver } from '@/editor/timer/TimerObserver'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'
import { orpc } from '@/api/client'
import { Toaster } from '@/components/vendor/Sonner'
import { TemplateDialog } from '@/controls/TemplateDialog'
import { openPanelTab, useSetPanelVisible } from '@/hooks/panel-state'
// Registers all commands with the editor's command registry.
import '@/commands/definitions'

export type RouterAppContext = {
  orpc: typeof orpc
}

const RootComponent = () => {
  const setPanelVisible = useSetPanelVisible()

  useGlobalKeybinding('searchPanel', () => openPanelTab('search'))

  useGlobalKeybinding('togglePanel', () => setPanelVisible((v) => !v))

  return (
    <>
      <TimerObserver />
      <Outlet />
      <Toaster />
      <TemplateDialog />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
