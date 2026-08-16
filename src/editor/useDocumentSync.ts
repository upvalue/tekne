// Load/save synchronization between a document's Jotai store and the server.
//
// Loads the named document into docAtom, tracks dirtiness via a store
// subscription, autosaves on an interval, saves before in-app navigation
// (blocking it while a timer runs), best-effort saves on tab close, answers
// tekne:request-save flushes from other UI trees, and reloads on a revision
// conflict instead of clobbering someone else's write.
import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'
import { truncate } from 'lodash-es'
import type { useStore } from 'jotai'
import { trpc } from '@/trpc/client'
import { TRPCClientError } from '@trpc/client'
import { useEventListener } from '@/hooks/useEventListener'
import { useInterval } from 'usehooks-ts'
import { docAtom, globalTimerAtom } from './state'
import { resetUndoHistory } from './undo'

const DOC_SAVE_INTERVAL = 5000

export const useDocumentSync = (
  title: string,
  store: ReturnType<typeof useStore>
) => {
  const docLastSaved = useRef<Date>(new Date())
  const docDirty = useRef<boolean>(false)
  const docRevision = useRef<number>(0)
  const utils = trpc.useUtils()

  const updateDocMutation = trpc.doc.updateDoc.useMutation({
    onSuccess: () => {
      utils.analysis.aggregateData.invalidate()
    },
    onError: (e) => {
      console.error(e)
      toast.error(
        `Error while updating document ${truncate(e.toString(), { length: 100 })}`
      )
    },
  })

  const loadDocQuery = trpc.doc.loadDoc.useQuery(
    { name: title },
    {
      enabled: () => !docDirty.current,
      retry: (_fc, error) => {
        if (error?.data?.code === 'NOT_FOUND') {
          return false
        }
        return true
      },
    }
  )

  const saveDocument = useCallback(
    async (chainOnSuccess?: () => void) => {
      // A failed load leaves the store holding its initial placeholder. There
      // is no server document to save in that case (most commonly a new daily
      // note), so let navigation continue without sending the placeholder.
      if (loadDocQuery.isLoading || !loadDocQuery.data) {
        if (chainOnSuccess) chainOnSuccess()
        return
      }

      // Doc hasn't changed, don't do anything
      if (store.get(docAtom) === loadDocQuery.data?.doc) {
        if (chainOnSuccess) chainOnSuccess()
        return
      }

      try {
        const { revision } = await updateDocMutation.mutateAsync({
          name: title,
          doc: store.get(docAtom),
          expectedRevision: docRevision.current,
        })
        docRevision.current = revision
        docDirty.current = false
        docLastSaved.current = new Date()

        if (chainOnSuccess) {
          chainOnSuccess()
        }
      } catch (e) {
        if (e instanceof TRPCClientError && e.data?.code === 'CONFLICT') {
          // The document changed underneath us (e.g. a tag rename rewrote
          // it). Drop local changes and reload rather than clobbering.
          docDirty.current = false
          await utils.doc.loadDoc.invalidate({ name: title })
          toast.warning('Document was updated elsewhere — reloaded')
          return
        }
        console.error('Error saving document', e)
        toast.error(
          `Error while updating document ${truncate(String(e), { length: 100 })}`
        )
      }
    },
    [
      title,
      store,
      updateDocMutation,
      loadDocQuery.isLoading,
      loadDocQuery.data,
      utils,
    ]
  )

  // Save before in-app navigation; refuse to navigate while a timer runs.
  useBlocker({
    shouldBlockFn: async () => {
      await saveDocument()
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
    // For browser navigation (close tab, refresh), we still save but can't await
    if (docDirty.current) {
      saveDocument()
    }
    // Only show browser confirmation if timer is active
    if (store.get(globalTimerAtom).isActive) {
      event.preventDefault()
      event.returnValue =
        'You have a timer running. Are you sure you want to leave?'
    }
  })

  // Autosave: at most once per DOC_SAVE_INTERVAL, only when dirty
  useInterval(() => {
    if (!docDirty.current) {
      return
    }
    if (
      new Date().getTime() - docLastSaved.current.getTime() <
      DOC_SAVE_INTERVAL
    ) {
      return
    }
    saveDocument()
  }, 1000)

  // Mark dirty on any document change that isn't the loaded snapshot itself
  useEffect(() => {
    if (loadDocQuery.isLoading) {
      return
    }
    const unsub = store.sub(docAtom, () => {
      if (store.get(docAtom) === loadDocQuery.data?.doc) {
        return
      }
      docDirty.current = true
    })

    return () => {
      return unsub()
    }
  }, [title, loadDocQuery.isLoading, store, loadDocQuery.data])

  // Hydrate the store when a (re)load lands
  useEffect(() => {
    if (!loadDocQuery.isLoading && loadDocQuery.data) {
      store.set(docAtom, loadDocQuery.data.doc)
      docRevision.current = loadDocQuery.data.revision
      resetUndoHistory(store)
    }
  }, [loadDocQuery.data, store, loadDocQuery.isLoading])

  // Allows components outside this route (e.g. the tag rename dialog in the
  // side panel) to flush any pending editor changes before a server-side
  // rewrite of documents.
  useEventListener('tekne:request-save', (event) => {
    saveDocument(event.detail?.onComplete)
  })

  return { loadDocQuery, saveDocument }
}
