import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { trpc } from '@/trpc/client'
import { Toaster } from '@/components/vendor/Sonner'
import { DocumentSearch } from '@/controls/DocumentSearch'

export type RouterAppContext = {
  trpc: typeof trpc
}

const RootComponent = () => {
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
