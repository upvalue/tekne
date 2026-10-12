import { openDocumentOutbox, type DocumentOutbox } from './document-outbox'
import { syncedDocumentAtom } from './document-sync-state'
import { diffDocuments } from '@/docs/document-patch'
import { ORPCError } from '@orpc/client'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
// Load/save synchronization between a document's Jotai store and the server.
//
// Loads the named document into docAtom, tracks edits with a per-document
// SaveQueue (immediate, serialized, locally durable), saves before
// in-app navigation, best-effort saves on tab hide/close, answers
// tekne:request-save flushes from other UI trees, and surfaces revision
// conflicts for the user to resolve instead of clobbering either side.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useBlocker } from '@tanstack/react-router'
import { notifications } from '@/lib/notifications'
import type { useStore } from 'jotai'
import { orpc } from '@/api/client'
import type { ZDoc } from '@/docs/schema'
import { useEventListener } from '@/hooks/useEventListener'
import { docAtom } from './state'
import { resetUndoHistory } from './undo'
import { SaveConflictError, SaveQueue, type SaveConflict } from './save-queue'

export const useDocumentSync = (
  title: string,
  store: ReturnType<typeof useStore>
) => {
  const utils = useQueryClient()
  const updateDocMutation = useMutation({
    ...orpc.doc.patchDoc.mutationOptions(),
    mutationFn: (input) =>
      orpc.doc.patchDoc.call(input, {
        signal: AbortSignal.timeout(15_000),
      }),
  })
  const [conflict, setConflict] = useState<SaveConflict<ZDoc> | null>(null)

  // Latest network closures for the queue, which outlives any single render.
  const mutateAsyncRef = useRef(updateDocMutation.mutateAsync)
  mutateAsyncRef.current = updateDocMutation.mutateAsync
  const utilsRef = useRef(utils)
  utilsRef.current = utils

  // True while this hook itself writes server content into docAtom, so the
  // subscription below can tell hydration from a user edit.
  const hydratingRef = useRef(false)
  // Set once server content has been hydrated; before that the store holds a
  // placeholder that must not be marked dirty or saved (most commonly a
  // missing daily note).
  const loadedRef = useRef(false)
  // Last revision this client wrote into the query cache or hydrated from
  // it; cache updates for that revision are our own saves, not new content.
  const serverRevisionRef = useRef<number | null>(null)

  const journals = useRef(new WeakMap<SaveQueue<ZDoc>, DocumentOutbox>())
  const [recoveryReady, setRecoveryReady] = useState<SaveQueue<ZDoc> | null>(
    null
  )

  const queue = useMemo(() => {
    loadedRef.current = false
    serverRevisionRef.current = null
    let storageErrorShown = false
    const created: SaveQueue<ZDoc> = new SaveQueue<ZDoc>({
      paused: true,
      persist: (state) =>
        journals.current.get(created)?.write(state) ?? Promise.resolve(),
      onPersistenceError: (error) => {
        if (storageErrorShown) return
        storageErrorShown = true
        notifications.error('Local recovery is unavailable', {
          description: `Keep this tab open until changes save. ${String(error)}`,
        })
      },
      revision: 0,
      getSnapshot: () => store.get(docAtom),
      performSave: (snapshot, expectedRevision, requestId, baseline) =>
        mutateAsyncRef.current({
          name: title,
          patch: diffDocuments(baseline, snapshot),
          expectedRevision,
          requestId,
        }),
      onSaved: (snapshot, revision) => {
        store.set(syncedDocumentAtom, { title, revision })
        serverRevisionRef.current = revision
        utilsRef.current.setQueryData(
          orpc.doc.loadDoc.queryKey({ input: { name: title } }),
          { doc: snapshot, revision }
        )
        void utilsRef.current.invalidateQueries({
          queryKey: orpc.analysis.key(),
        })
      },
      onConflict: (c) => setConflict(c),
      onSaveError: (error) => {
        console.error('Error saving document', error)
        notifications.error('Could not save document', {
          description: String(error),
        })
      },
    })
    return created
  }, [title, store])

  const queueRef = useRef(queue)
  queueRef.current = queue

  useEffect(() => {
    let cancelled = false
    const abort = new AbortController()
    let journal: DocumentOutbox | undefined
    setConflict(null)
    const scope = `${import.meta.env.BASE_URL}:${import.meta.env.TEKNE_DEMO ? 'demo' : import.meta.env.TEKNE_ORPC_URL || '/api/rpc'}`
    void openDocumentOutbox(title, scope, abort.signal)
      .then((opened) => {
        journal = opened
        if (cancelled) {
          opened.close()
          return
        }
        journals.current.set(queue, opened)
        if (opened.recovered) {
          const recovered = opened.recovered
          queue.restore(recovered)
          serverRevisionRef.current = recovered.revision
          hydratingRef.current = true
          try {
            store.set(docAtom, recovered.snapshot)
            store.set(syncedDocumentAtom, {
              title,
              revision: recovered.revision,
            })
          } finally {
            hydratingRef.current = false
          }
          loadedRef.current = true
          resetUndoHistory(store)
          utilsRef.current.setQueryData(
            orpc.doc.loadDoc.queryKey({ input: { name: title } }),
            { doc: recovered.baseline, revision: recovered.revision }
          )
          if (opened.otherDrafts > 0)
            notifications.info('Recovered a local draft', {
              description:
                'Other local copies may exist in another tab. After saving this copy, reopen the document to recover any remaining closed-tab copy.',
            })
        }
      })
      .catch((error) => {
        if (!cancelled)
          notifications.error('Local recovery is unavailable', {
            description: `Keep this tab open until changes save. ${String(error)}`,
          })
      })
      .finally(() => {
        if (!cancelled) {
          setRecoveryReady(queue)
          queue.activate()
        }
      })
    return () => {
      cancelled = true
      abort.abort()
      queue.dispose()
      void queue.persisted().then(() => journal?.close())
    }
  }, [queue, title, store])

  const loadDocQuery = useQuery(
    orpc.doc.loadDoc.queryOptions({
      input: { name: title },
      enabled: () => recoveryReady === queue && !queueRef.current.isDirty(),
      refetchInterval: 5000,
      retry: (failureCount, error) => {
        if (error instanceof ORPCError && error.code === 'NOT_FOUND') {
          return false
        }
        return failureCount < 2
      },
    })
  )

  // Hydrate the store when genuinely new server content lands. Cache writes
  // from our own saves are skipped by revision, and unsaved local work is
  // never overwritten (a losing save surfaces as a conflict instead).
  useLayoutEffect(() => {
    if (
      recoveryReady !== queue ||
      loadDocQuery.isLoading ||
      !loadDocQuery.data
    ) {
      return
    }
    const { doc, revision } = loadDocQuery.data
    if (serverRevisionRef.current === revision || queue.isDirty()) {
      return
    }
    serverRevisionRef.current = revision
    queue.hydrate(doc, revision)
    hydratingRef.current = true
    try {
      store.set(docAtom, doc)
      store.set(syncedDocumentAtom, { title, revision })
    } finally {
      hydratingRef.current = false
    }
    loadedRef.current = true
    resetUndoHistory(store)
  }, [
    loadDocQuery.data,
    loadDocQuery.isLoading,
    store,
    queue,
    title,
    recoveryReady,
  ])

  // Every non-hydration docAtom change is a new generation to save.
  useEffect(() => {
    return store.sub(docAtom, () => {
      if (hydratingRef.current || !loadedRef.current) {
        return
      }
      queue.noteEdit()
    })
  }, [store, queue])

  /**
   * Drain every unsaved generation. Resolves once the server acknowledged
   * them all; rejects on failure or a pending conflict, keeping local state.
   */
  const flushDocument = useCallback((): Promise<void> => {
    if (!loadedRef.current) {
      return Promise.resolve()
    }
    return queue.flush()
  }, [queue])

  const resolveConflict = useCallback(
    (choice: 'keepMine' | 'takeServer') => {
      const current = queue.getConflict()
      if (current === null) {
        setConflict(null)
        return
      }
      if (choice === 'keepMine') {
        queue.resolveKeepMine()
      } else {
        serverRevisionRef.current = current.serverRevision
        hydratingRef.current = true
        try {
          store.set(docAtom, current.serverDoc)
          store.set(syncedDocumentAtom, {
            title,
            revision: current.serverRevision,
          })
        } finally {
          hydratingRef.current = false
        }
        queue.resolveTakeServer()
        utilsRef.current.setQueryData(
          orpc.doc.loadDoc.queryKey({ input: { name: title } }),
          { doc: current.serverDoc, revision: current.serverRevision }
        )
        // Undo history survives on purpose: undoing after "take server"
        // brings the local text back as a fresh edit, so nothing is
        // irrecoverable.
      }
      setConflict(null)
    },
    [queue, store, title]
  )

  // Save before in-app navigation; stay on the page while a save fails, a
  // conflict is unresolved.
  useBlocker({
    shouldBlockFn: async () => {
      try {
        await flushDocument()
      } catch (e) {
        if (!(e instanceof SaveConflictError)) {
          // The conflict case already shows the resolution dialog
          notifications.error('Unsaved changes could not be saved', {
            action: {
              label: 'Discard changes',
              onClick: () => {
                queueRef.current.discardLocal()
                void utilsRef.current.invalidateQueries({
                  queryKey: orpc.doc.loadDoc.key({
                    input: { name: title },
                    type: 'query',
                  }),
                })
              },
            },
          })
        }
        return true
      }
      return false
    },
    enableBeforeUnload: false,
  })

  useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
    // For browser navigation (close tab, refresh) the flush can't be
    // awaited; start it and ask for confirmation while work is unsaved.
    if (queue.isDirty()) {
      flushDocument().catch(() => {})
      event.preventDefault()
      event.returnValue =
        'You have unsaved changes. Are you sure you want to leave?'
    }
  })

  // Best-effort flush when the tab is hidden or entering the page cache
  useEventListener('online', () => {
    if (queue.isDirty()) flushDocument().catch(() => {})
  })

  useEventListener('pagehide', () => {
    if (queue.isDirty()) {
      flushDocument().catch(() => {})
    }
  })
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && queue.isDirty()) {
        flushDocument().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [queue, flushDocument])

  // Components outside this route (e.g. the tag rename dialog in the side
  // panel) flush pending editor changes before a server-side rewrite.
  // Dispatch is synchronous, so attaching the promise to the detail is how
  // the sender learns an editor is mounted at all.
  useEventListener('tekne:request-save', (event) => {
    event.detail.flush = flushDocument()
  })

  return {
    loadDocQuery:
      recoveryReady === queue
        ? loadDocQuery
        : {
            ...loadDocQuery,
            isSuccess: false as const,
            isLoading: true as const,
            isError: false as const,
            error: null,
          },
    flushDocument,
    conflict,
    resolveConflict,
  }
}
