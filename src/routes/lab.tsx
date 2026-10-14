import { TEditor } from '@/editor/TEditor'
import { createFileRoute } from '@tanstack/react-router'
import { docAtom } from '@/editor/state'
import { docMake, lineMake } from '@/docs/schema'
import { createStore } from 'jotai'
import { useMemo } from 'react'
import { EditorShell } from '@/layout/EditorShell'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { notifications } from '@/lib/notifications'

export const Route = createFileRoute('/lab')({
  component: RouteComponent,
})

/** Isolated editor using the real EditorShell without server sync. */
function RouteComponent() {
  useCodemirrorEvent('internalLinkClick', (data) => {
    notifications.info(`Clicked internal link ${data.link}`)
  })

  useCodemirrorEvent('tagClick', (data) => {
    notifications.info(`Clicked tag ${data.name}`)
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
