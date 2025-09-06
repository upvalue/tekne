import { TEditor } from '@/editor/TEditor'
import { toast } from 'sonner'
import { docAtom } from '@/editor/state'
import { createStore } from 'jotai'
import '@/editor/schema'
import { truncate } from 'lodash-es'
import { Provider } from 'jotai'
import { trpc } from '@/trpc'
import { createFileRoute, useBlocker, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { EditorLayout } from '@/layout/EditorLayout'
import { Panel } from '@/panel/Panel'
import { TitleBar } from '@/editor/TitleBar'
import { StatusBar } from '@/editor/StatusBar'
import { setMainTitle } from '@/lib/title'
import { useEventListener } from '@/hooks/useEventListener'
import { useInterval } from 'usehooks-ts'

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

  const docLastSaved = useRef<Date>(new Date());
  const docDirty = useRef<boolean>(false);
  const userNavigatingAway = useRef<boolean>(false);
  // TODO: this whole thing needs a bit of cleanup

  useEffect(() => {
    setMainTitle(title)
  }, [title])

  const updateDocMutation = trpc.updateDoc.useMutation({
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

  const loadDocQuery = trpc.loadDoc.useQuery({ name: title })

  // Document saving functionality
  // On an interval, if the document has changed this will send an updateDoc mutation

  // It tries not to do anything if (1) less than 5 seconds have elapsed since last updateDoc
  // or (2) doc has not changed

  // It also uses beforeunload to try to prevent user from navigating away if 

  const saveDocument = useCallback(() => {
    if (loadDocQuery.isLoading) {
      return
    }

    // Doc hasn't changed, don't do anything
    if (store.get(docAtom) === loadDocQuery.data) {
      return
    }
    updateDocMutation.mutate({
      name: title,
      doc: store.get(docAtom),
    }, {
      onSuccess: () => {
        docDirty.current = false;
        docLastSaved.current = new Date();

        if (userNavigatingAway.current) {
          toast.info('Your changes have been saved, you can navigate away now');
          userNavigatingAway.current = false;
        }
      }
    })
  }, [title, store, updateDocMutation, loadDocQuery.isLoading])

  // Try to save document if user navigates away while a change is present
  // We don't use "enableBeforeUnload" right now because it always registers
  // a beforeunload handler, which is a little overzealous in prompting;
  // this could probably be used better

  // Probably 
  useBlocker({
    shouldBlockFn: () => {
      console.log('tanstack blocker triggered save');
      saveDocument();
      return false;
    },
    enableBeforeUnload: false,
  })

  useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
    userNavigatingAway.current = true;
    if (docDirty.current) {
      saveDocument();
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
    return false;
  })

  useInterval(() => {
    if (!docDirty.current) {
      return;
    }
    if (new Date().getTime() - docLastSaved.current.getTime() < DOC_SAVE_INTERVAL) {
      return;
    }
    saveDocument();
  }, 1000)

  useEffect(() => {
    if (loadDocQuery.isLoading) {
      return
    }
    const unsub = store.sub(docAtom, () => {
      // Document changed, mark dirty
      docDirty.current = true;
      // Don't try to save if less than five seconds have elapsed
      // saveDocument();
    })

    return () => {
      return unsub()
    }
  }, [title, loadDocQuery.isLoading, store, updateDocMutation, loadDocQuery.data])

  useEffect(() => {
    if (!loadDocQuery.isLoading && loadDocQuery.data) {
      store.set(docAtom, loadDocQuery.data)
    }
  }, [loadDocQuery.data, store, loadDocQuery.isLoading])

  const navigate = useNavigate()

  useCodemirrorEvent('wikiLinkClick', (event) => {
    navigate({
      to: '/n/$title',
      params: {
        title: event.link,
      },
    }).then(() => { })
  })

  return (
    <Provider store={store}>
      <EditorLayout
        editor={
          <>
            <TitleBar title={title} allowTitleEdit={true} />
            <StatusBar />
            {loadDocQuery.isLoading ? <div>Loading...</div> : <TEditor />}
          </>
        }
        sidepanel={<Panel />}
      />
    </Provider>
  )
}
