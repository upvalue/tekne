import { ORPCError } from '@orpc/client'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
// Load/save synchronization between a document's Jotai store and the server.
//
// Loads the named document into docAtom, tracks edits with a per-document
// SaveQueue (debounced, serialized, generation-acknowledged), saves before
// in-app navigation, best-effort saves on tab hide/close, answers
// tekne:request-save flushes from other UI trees, and surfaces revision
// conflicts for the user to resolve instead of clobbering either side.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'
import { truncate } from 'lodash-es'
import type { useStore } from 'jotai'
import { orpc } from '@/api/client'
import type { ZDoc } from '@/docs/schema'
import { useEventListener } from '@/hooks/useEventListener'
import { docAtom, globalTimerAtom } from './state'
import { resetUndoHistory } from './undo'
import { SaveConflictError, SaveQueue, type SaveConflict } from './save-queue'

export const useDocumentSync = (
  title: string,
  store: ReturnType<typeof useStore>
) => {
  const utils = useQueryClient()
  const updateDocMutation = useMutation(orpc.doc.updateDoc.mutationOptions())
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

  const queue = useMemo(() => {
    loadedRef.current = false
    serverRevisionRef.current = null
    return new SaveQueue<ZDoc>({
      revision: 0,
      getSnapshot: () => store.get(docAtom),
      performSave: (snapshot, expectedRevision) =>
        mutateAsyncRef.current({
          name: title,
          doc: snapshot,
          expectedRevision,
        }),
      onSaved: (snapshot, revision) => {
        serverRevisionRef.current = revision
        utilsRef.current.setQueryData(
          orpc.doc.loadDoc.queryKey({ input: { name: title } }),
          { doc: snapshot, revision }
        )
        utilsRef.current.invalidateQueries({
          queryKey: orpc.analysis.aggregateData.key(),
        })
      },
      onConflict: (c) => setConflict(c),
      onSaveError: (error) => {
        console.error('Error saving document', error)
        toast.error(
          `Error while updating document ${truncate(String(error), { length: 100 })}`
        )
      },
    })
  }, [title, store])

  const queueRef = useRef(queue)
  queueRef.current = queue

  useEffect(() => {
    queue.activate()
    setConflict(null)
    return () => queue.dispose()
  }, [queue])

  const loadDocQuery = useQuery(
    orpc.doc.loadDoc.queryOptions({
      input: { name: title },
      enabled: () => !queueRef.current.isDirty(),
      retry: (_fc, error) => {
        if (error instanceof ORPCError && error.code === 'NOT_FOUND') {
          return false
        }
        return true
      },
    })
  )

  // Hydrate the store when genuinely new server content lands. Cache writes
  // from our own saves are skipped by revision, and unsaved local work is
  // never overwritten (a losing save surfaces as a conflict instead).
  useEffect(() => {
    if (loadDocQuery.isLoading || !loadDocQuery.data) {
      return
    }
    const { doc, revision } = loadDocQuery.data
    if (serverRevisionRef.current === revision || queue.isDirty()) {
      return
    }
    serverRevisionRef.current = revision
    queue.setRevision(revision)
    hydratingRef.current = true
    try {
      store.set(docAtom, doc)
    } finally {
      hydratingRef.current = false
    }
    loadedRef.current = true
    resetUndoHistory(store)
  }, [loadDocQuery.data, loadDocQuery.isLoading, store, queue])

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
  // conflict is unresolved, or a timer runs.
  useBlocker({
    shouldBlockFn: async () => {
      try {
        await flushDocument()
      } catch (e) {
        if (!(e instanceof SaveConflictError)) {
          // The conflict case already shows the resolution dialog
          toast.error('Unsaved changes could not be saved', {
            action: {
              label: 'Discard changes',
              onClick: () => {
                queueRef.current.discardLocal()
                utilsRef.current.invalidateQueries({
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
      if (store.get(globalTimerAtom).isActive) {
        toast.info(
          'There is a timer active -- end the timer before navigating away'
        )
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
    if (store.get(globalTimerAtom).isActive) {
      event.preventDefault()
      event.returnValue =
        'You have a timer running. Are you sure you want to leave?'
    }
  })

  // Best-effort flush when the tab is hidden or entering the page cache
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

  return { loadDocQuery, flushDocument, conflict, resolveConflict }
}
