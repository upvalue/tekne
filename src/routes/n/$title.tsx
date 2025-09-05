import { TEditor } from '@/editor/TEditor'
import { toast } from 'sonner'
import { docAtom } from '@/editor/state'
import { createStore } from 'jotai'
import '@/editor/schema'
import { truncate } from 'lodash-es'
import { Provider } from 'jotai'
import { trpc } from '@/trpc'
import { createFileRoute, useBlocker, useNavigate } from '@tanstack/react-router'
import { use, useCallback, useEffect, useMemo, useRef } from 'react'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { EditorLayout } from '@/layout/EditorLayout'
import { Panel } from '@/panel/Panel'
import { TitleBar } from '@/editor/TitleBar'
import { StatusBar } from '@/editor/StatusBar'
import { setMainTitle } from '@/lib/title'

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

  // This is going to be a little overzealous in saving the doc
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
    })
  }, [title, store, updateDocMutation, loadDocQuery.isLoading])

  // Try to save document if user navigates away while a change is present
  useBlocker({
    shouldBlockFn: () => {
      saveDocument();
      return false;
    }
  })

  useEffect(() => {
    if (loadDocQuery.isLoading) {
      return
    }
    const unsub = store.sub(docAtom, () => {
      // Check for whether change interval has elapsed, then leave
      if (new Date().getTime() - docLastSaved.current.getTime() < DOC_SAVE_INTERVAL) {
        console.log('has been less than five seconds since last save');
        return;
      }
      docLastSaved.current = new Date();
      saveDocument();
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
