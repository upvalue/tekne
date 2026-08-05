import { TEditor } from '@/editor/TEditor'
import { createFileRoute } from '@tanstack/react-router'
import { docAtom } from '@/editor/state'
import { docMake, lineMake } from '@/docs/schema'
import { createStore } from 'jotai'
import { useMemo } from 'react'
import { EditorShell } from '@/layout/EditorShell'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { toast } from 'sonner'

export const Route = createFileRoute('/lab')({
  component: RouteComponent,
})

/**
 * Standalone document editor for testing in isolation from the rest of the
 * app. Renders through the same EditorShell as the real editor route, so
 * what happens here is what happens there — minus the server sync.
 */
function RouteComponent() {
  useCodemirrorEvent('internalLinkClick', (data) => {
    toast.info(`Clicked internal link ${data.link}`)
  })

  useCodemirrorEvent('tagClick', (data) => {
    toast.info(`Clicked tag ${data.name}`)
  })

  const store = useMemo(() => {
    const store = createStore()
    store.set(
      docAtom,
      docMake([lineMake(0, '_italic_ **bold** ~~strikethrough~~ ')])
    )
    return store
  }, [])

  return (
    <EditorShell store={store} title="Lab">
      <TEditor />
    </EditorShell>
  )
}
