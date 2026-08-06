import { Provider } from 'jotai'
import type { createStore } from 'jotai'
import { CommandPaletteProvider } from '@/commands/CommandPaletteProvider'
import { EditorLayout } from './EditorLayout'
import { TitleBar } from '@/editor/TitleBar'
import { StatusBar } from '@/editor/StatusBar'
import { Panel } from '@/panel/Panel'
import { TouchBar } from '@/editor/touch/TouchBar'
import { useSyncDisplayMode } from '@/hooks/display-mode'

/**
 * The editor page shell: a (per-document) Jotai store, command palette
 * wiring, and the editor/panel layout with title and status bars. The main
 * editor route, /lab, and the doc-not-found page all render through this so
 * they exercise the same tree.
 */
export const EditorShell = ({
  store,
  title,
  allowTitleEdit = false,
  isLoading = false,
  children,
}: {
  /** Omit to let the Provider create a fresh store. */
  store?: ReturnType<typeof createStore>
  title: string
  allowTitleEdit?: boolean
  isLoading?: boolean
  /** Editor content rendered below the title and status bars. */
  children?: React.ReactNode
}) => {
  useSyncDisplayMode()

  return (
    <Provider store={store}>
      <CommandPaletteProvider>
        <EditorLayout
          editor={
            <>
              <TitleBar title={title} allowTitleEdit={allowTitleEdit} />
              <StatusBar isLoading={isLoading} />
              {children}
              <TouchBar />
            </>
          }
          sidepanel={<Panel />}
        />
      </CommandPaletteProvider>
    </Provider>
  )
}
