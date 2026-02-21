import { TEditor } from '@/editor/TEditor'
import { toast } from 'sonner'
import { allTagsAtom, docAtom, globalTimerAtom } from '@/editor/state'
import { resetUndoHistory } from '@/editor/undo'
import { documentUndoEnabledAtom } from '@/lib/feature-flags'
import { createStore, useAtom } from 'jotai'
import '@/docs/schema'
import { truncate } from 'lodash-es'
import { Provider } from 'jotai'
import { trpc } from '@/trpc/client'
import {
  createFileRoute,
  useBlocker,
  useNavigate,
} from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { EditorLayout } from '@/layout/EditorLayout'
import { Panel } from '@/panel/Panel'
import { TitleBar } from '@/editor/TitleBar'
import { StatusBar } from '@/editor/StatusBar'
import { setMainTitle } from '@/lib/title'
import { useEventListener } from '@/hooks/useEventListener'
import { useInterval } from 'usehooks-ts'
import { useCreateDoc } from '@/hooks/useCreateDoc'
import { CommandPaletteProvider } from '@/commands/CommandPaletteProvider'

const DOC_SAVE_INTERVAL = 5000

export const Route = createFileRoute('/n/$title')({
  component: RouteComponent,
})

/**
 * This is the main editor route. It handles some synchronization between
 * Jotai state and TRPC, loading a document based on a title and updating the document
 * when it changes on an interval
 */
function RouteComponent() {
  const title = Route.useParams({
    select: (p) => p.title,
  })
  const navigate = useNavigate()

  const docLastSaved = useRef<Date>(new Date())
  const docDirty = useRef<boolean>(false)
  const utils = trpc.useUtils();
  // TODO: this whole thing needs a bit of cleanup

  useEffect(() => {
    setMainTitle(title)
  }, [title])

  const updateDocMutation = trpc.doc.updateDoc.useMutation({
    onSuccess: () => {
      utils.analysis.aggregateData.invalidate();
    },
    onError: (e) => {
      console.error(e)
      toast.error(
        `Error while updating document ${truncate(e.toString(), { length: 100 })}`
      )
    },
  })

  // Set up Jotai store
  const store = useMemo(() => {
    const store = createStore()
    return store
  }, [])

  const loadDocQuery = trpc.doc.loadDoc.useQuery({ name: title }, {
    enabled: () => !docDirty.current,
    retry: (_fc, error) => {
      if (error?.data?.code === 'NOT_FOUND') {
        return false
      }
      return true
    }
  })

  // Sync feature flags into the editor's isolated Jotai store
  const flagsQuery = trpc.flags.getAll.useQuery()
  useEffect(() => {
    if (flagsQuery.data) {
      store.set(documentUndoEnabledAtom, !!flagsQuery.data['document_undo'])
    }
  }, [flagsQuery.data, store])

  const createDocMutation = useCreateDoc();

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

  // Document saving functionality
  // On an interval, if the document has changed this will send an updateDoc mutation

  // It tries not to do anything if (1) less than 5 seconds have elapsed since last updateDoc
  // or (2) doc has not changed

  // It also uses beforeunload to try to prevent user from navigating away if

  const saveDocument = useCallback(async (chainOnSuccess?: () => void) => {
    if (loadDocQuery.isLoading) {
      return
    }

    // Doc hasn't changed, don't do anything
    if (store.get(docAtom) === loadDocQuery.data) {
      if (chainOnSuccess) chainOnSuccess();
      return
    }

    try {
      await updateDocMutation.mutateAsync({
        name: title,
        doc: store.get(docAtom),
      })
      docDirty.current = false
      docLastSaved.current = new Date()

      if (chainOnSuccess) {
        chainOnSuccess()
      }
    } catch (e) {
      console.error('Error saving document', e)
      toast.error(
        `Error while updating document ${truncate(String(e), { length: 100 })}`
      )
    }
  }, [title, store, updateDocMutation, loadDocQuery.isLoading, loadDocQuery.data])

  // Try to save document if user navigates away while a change is present
  // We don't use "enableBeforeUnload" right now because it always registers
  // a beforeunload handler, which is a little overzealous in prompting;
  // this could probably be used better

  // Side effect to cause query to fire
  useAtom(allTagsAtom);

  useBlocker({
    shouldBlockFn: async () => {
      await saveDocument()
      if (store.get(globalTimerAtom).isActive) {
        toast.info('There is a timer active -- end the timer before navigating away');
        return true;
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
      event.returnValue = 'You have a timer running. Are you sure you want to leave?'
    }
  })

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

  useEffect(() => {
    if (loadDocQuery.isLoading) {
      return
    }
    const unsub = store.sub(docAtom, () => {
      // Document changed, mark dirty
      if (store.get(docAtom) === loadDocQuery.data) {
        return
      }
      docDirty.current = true
      // Don't try to save if less than five seconds have elapsed
      // saveDocument();
    })

    return () => {
      return unsub()
    }
  }, [
    title,
    loadDocQuery.isLoading,
    store,
    updateDocMutation,
    loadDocQuery.data,
  ])

  useEffect(() => {
    if (!loadDocQuery.isLoading && loadDocQuery.data) {
      store.set(docAtom, loadDocQuery.data)
      resetUndoHistory(store)
    }
  }, [loadDocQuery.data, store, loadDocQuery.isLoading])

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
    <Provider store={store}>
      <CommandPaletteProvider>
        <EditorLayout
          editor={
            <>
              <TitleBar title={title} allowTitleEdit={true} />
              <StatusBar isLoading={loadDocQuery.isLoading} />
              {!loadDocQuery.isLoading && <TEditor />}
            </>
          }
          sidepanel={<Panel />}
        />
      </CommandPaletteProvider>
    </Provider>
  )
}
