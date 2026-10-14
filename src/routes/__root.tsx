import { useEventListener } from '@/hooks/useEventListener'
import type { QueryClient } from '@tanstack/react-query'
import { HelpDialog } from '@/panel/Help'
import { TimerObserver } from '@/editor/timer/TimerObserver'
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'
import { orpc } from '@/api/client'
import { NotificationScratchpad } from '@/components/NotificationScratchpad'
import { useEmbeddedNotificationBar } from '@/components/embedded-notification-bar'
import { notifications } from '@/lib/notifications'
import { useEffect, useRef } from 'react'
import { TemplateDialog } from '@/controls/TemplateDialog'
import { openSearch, useSetPanelVisible } from '@/hooks/panel-state'
// Registers all commands with the editor's command registry.
import '@/commands/definitions'

export type RouterAppContext = {
  orpc: typeof orpc
  queryClient: QueryClient
}

const RootComponent = () => {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current !== pathname) notifications.expireActions()
    previousPath.current = pathname
  }, [pathname])
  useEventListener('tekne:navigate-document', ({ detail }) => {
    void navigate({
      to: '/n/$title',
      params: { title: detail.title },
      hash: detail.lineId ? `line-${detail.lineId}` : '',
    })
  })
  const setPanelVisible = useSetPanelVisible()
  const embeddedBar = useEmbeddedNotificationBar()

  useGlobalKeybinding('searchPanel', openSearch)

  useGlobalKeybinding('togglePanel', () => setPanelVisible((v) => !v))

  return (
    <>
      <TimerObserver />
      <div className="AppContent" data-embedded-bar={embeddedBar || undefined}>
        <Outlet />
      </div>
      {!embeddedBar && <NotificationScratchpad />}
      <TemplateDialog />
      <HelpDialog />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
