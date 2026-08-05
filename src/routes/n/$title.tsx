import { TEditor } from '@/editor/TEditor'
import { allTagsAtom } from '@/editor/state'
import { releaseTimer } from '@/editor/timer/timer-controller'
import { useDocumentSync } from '@/editor/useDocumentSync'
import { createStore, useAtom } from 'jotai'
import { trpc } from '@/trpc/client'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { EditorShell } from '@/layout/EditorShell'
import { setMainTitle } from '@/lib/title'
import { useCreateDoc } from '@/hooks/useCreateDoc'

export const Route = createFileRoute('/n/$title')({
  component: RouteComponent,
})

/**
 * The main editor route: a per-document Jotai store synchronized with the
 * server by useDocumentSync, rendered through the shared EditorShell.
 */
function RouteComponent() {
  const title = Route.useParams({
    select: (p) => p.title,
  })
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  useEffect(() => {
    setMainTitle(title)
  }, [title])

  // Set up Jotai store
  const store = useMemo(() => {
    return createStore()
  }, [])

  // The navigation blocker in useDocumentSync normally prevents leaving with
  // a timer running, but if this route unmounts anyway the interval and the
  // title marker must not outlive the store.
  useEffect(() => {
    return () => releaseTimer(store)
  }, [store])

  const { loadDocQuery, saveDocument } = useDocumentSync(title, store)

  // Side effect to cause query to fire
  useAtom(allTagsAtom)

  const createDocMutation = useCreateDoc()

  useEffect(() => {
    if (loadDocQuery.error && loadDocQuery.error.data?.code === 'NOT_FOUND') {
      // Special case tutorial - auto-create it
      if (title === 'Tutorial') {
        // Skip if mutation is already in flight
        if (createDocMutation.isPending) {
          return
        }
        // Create the tutorial, then invalidate the query to refetch
        createDocMutation.mutateAsync({ name: title }).then(() => {
          utils.doc.loadDoc.invalidate({ name: title })
        })
        return
      }
      // For non-tutorial documents
      navigate({
        to: '/doc-not-found/$title',
        params: { title: title },
        replace: true,
      })
    }
  }, [loadDocQuery.error, navigate, title, createDocMutation, utils])

  useCodemirrorEvent('internalLinkClick', (event) => {
    saveDocument(() => {
      navigate({
        to: '/open/$title',
        params: {
          title: event.link,
        },
      })
    })
  })

  return (
    <EditorShell
      store={store}
      title={title}
      allowTitleEdit={true}
      isLoading={loadDocQuery.isLoading}
    >
      {!loadDocQuery.isLoading && <TEditor />}
    </EditorShell>
  )
}
