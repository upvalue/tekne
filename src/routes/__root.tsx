import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { trpc } from '@/trpc/client'
import { Toaster } from '@/components/vendor/Sonner'
import { DocumentSearch } from '@/controls/DocumentSearch'
import { TemplateDialog } from '@/controls/TemplateDialog'
import type { PanelTab } from '@/panel/state'
import { documentUndoEnabledAtom } from '@/lib/feature-flags'

export type RouterAppContext = {
  trpc: typeof trpc
}

const RootComponent = () => {
  // Load feature flags and sync to synchronous atoms
  const flagsQuery = trpc.flags.getAll.useQuery()
  const setDocumentUndoEnabled = useSetAtom(documentUndoEnabledAtom)

  useEffect(() => {
    if (flagsQuery.data) {
      setDocumentUndoEnabled(!!flagsQuery.data['document_undo'])
    }
  }, [flagsQuery.data, setDocumentUndoEnabled])

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
      <TemplateDialog />
    </DocumentSearch>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})
