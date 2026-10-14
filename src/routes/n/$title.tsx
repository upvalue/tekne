import { ErrorState } from '@/components/ErrorState'
import { ORPCError } from '@orpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { TEditor } from '@/editor/TEditor'
import { SaveConflictDialog } from '@/editor/SaveConflictDialog'
import { allTagsAtom } from '@/editor/state'
import { useTimerSync } from '@/editor/timer/useTimerSync'
import { useDocumentSync } from '@/editor/useDocumentSync'
import { createStore, useAtom } from 'jotai'
import { orpc } from '@/api/client'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { EditorShell } from '@/layout/EditorShell'
import { setMainTitle } from '@/lib/title'
import { useCreateDoc } from '@/hooks/useCreateDoc'

export const Route = createFileRoute('/n/$title')({
  component: RouteComponent,
  pendingMs: Infinity,
  loader: ({ context, params }) => {
    // Local recovery must be able to mount even when the network is stalled.
    void context.queryClient.prefetchQuery({
      ...context.orpc.doc.loadDoc.queryOptions({
        input: { name: params.title },
      }),
      retry: false,
      staleTime: 1000,
    })
  },
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
  const utils = useQueryClient()

  useEffect(() => {
    setMainTitle(title)
  }, [title])

  const store = useMemo(() => {
    return createStore()
  }, [])

  const { loadDocQuery, flushDocument, conflict, resolveConflict } =
    useDocumentSync(title, store)
  useTimerSync(title, store, flushDocument)

  useAtom(allTagsAtom)

  const createDocMutation = useCreateDoc()
  const notFoundRedirectedTitle = useRef<string | null>(null)

  useEffect(() => {
    if (!loadDocQuery.error) {
      notFoundRedirectedTitle.current = null
      return
    }

    if (
      loadDocQuery.error instanceof ORPCError &&
      loadDocQuery.error.code === 'NOT_FOUND'
    ) {
      if (title === 'Tutorial' || /^\d{4}-\d{2}-\d{2}$/.test(title)) {
        if (createDocMutation.isPending) {
          return
        }
        createDocMutation.mutate(
          { name: title },
          {
            onError: (error) => {
              if (error instanceof ORPCError && error.code === 'CONFLICT') {
                return utils.invalidateQueries({
                  queryKey: orpc.doc.loadDoc.key({
                    input: { name: title },
                    type: 'query',
                  }),
                })
              }
            },
            onSuccess: () => {
              return utils.invalidateQueries({
                queryKey: orpc.doc.loadDoc.key({
                  input: { name: title },
                  type: 'query',
                }),
              })
            },
          }
        )
        return
      }
      if (notFoundRedirectedTitle.current === title) {
        return
      }
      notFoundRedirectedTitle.current = title
      void navigate({
        to: '/doc-not-found/$title',
        params: { title: title },
        replace: true,
      })
    }
  }, [loadDocQuery.error, navigate, title, createDocMutation, utils])

  useCodemirrorEvent('internalLinkClick', (event) => {
    // A failed flush keeps us on the page; the sync hook already surfaced it
    flushDocument()
      .then(() =>
        navigate({
          to: '/open/$title',
          params: {
            title: event.link,
          },
        })
      )
      .catch(() => {})
  })

  return (
    <EditorShell
      store={store}
      title={title}
      allowTitleEdit={true}
      isLoading={loadDocQuery.isLoading}
    >
      {loadDocQuery.isError &&
      !(
        loadDocQuery.error instanceof ORPCError &&
        loadDocQuery.error.code === 'NOT_FOUND'
      ) ? (
        <ErrorState
          title="Could not load this document"
          message="Check your connection and try again."
          detail={loadDocQuery.error.message}
          onRetry={() => void loadDocQuery.refetch()}
          busy={loadDocQuery.isFetching}
        />
      ) : (
        loadDocQuery.isSuccess && <TEditor />
      )}

      <SaveConflictDialog
        open={conflict !== null}
        onResolve={resolveConflict}
      />
    </EditorShell>
  )
}
