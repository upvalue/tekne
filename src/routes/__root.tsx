import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { trpc } from '@/trpc'
import { Toaster } from '@/components/vendor/Sonner'
import { DocumentSearch } from '@/controls/DocumentSearch'
import { CommandPalette } from '@/controls/CommandPalette'

export type RouterAppContext = {
  trpc: typeof trpc
}

const RootComponent = () => {
  return (
    <DocumentSearch>
      <CommandPalette>
        <Outlet />
        <Toaster />
      </CommandPalette>
    </DocumentSearch>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
