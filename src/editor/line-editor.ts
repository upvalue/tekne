import { useEffect, useLayoutEffect, useRef } from 'react'

import { EditorView, keymap } from '@codemirror/view'
import { emacsStyleKeymap } from '@codemirror/commands'
import {
  Annotation,
  EditorSelection,
  EditorState,
  type Extension,
} from '@codemirror/state'
import { type ZLine } from '@/docs/schema'
import { useAtom, useSetAtom, useStore } from 'jotai'
import {
  docAtom,
  focusedLineAtom,
  focusedPosAtom,
  requestFocusLineAtom,
} from './state'
import { autocompletion } from '@codemirror/autocomplete'
import { useLineEvent } from './line-editor/cm-events'
import { baseLineThemeSpec } from './line-visuals'
import { slashCommandsPlugin } from './line-editor/slash-commands-plugin'
import { makeKeymap, toggleCollapse } from './line-editor/line-operations'
import { syntaxPlugin } from './line-editor/syntax-plugin'
import { tagCompletionPlugin } from './line-editor/tag-completion-plugin'
import { getDisplayMode } from '@/hooks/display-mode'
import {
  touchEditingLineIdAtom,
  touchSelectedLineIdAtom,
} from './touch/touch-atoms'

/** Mark external state updates so the listener does not echo them back to docAtom. */
export const externalSyncAnnotation = Annotation.define<boolean>()

const theme = EditorView.theme(
  {
    ...baseLineThemeSpec,
    '.cm-completionIcon': {
      display: 'none',
    },
  },
  { dark: true }
)

export { useCodemirrorEvent, useLineEvent } from './line-editor/cm-events'

export type LineWithIdx = {
  line: ZLine
  lineIdx: number
}

/** Mount CodeMirror into the returned ref and sync its content with document state. */
export const useCodeMirror = (lineInfo: LineWithIdx) => {
  const cmRef = useRef<HTMLDivElement>(null)
  const cmView = useRef<EditorView | null>(null)
  // useSetAtom: a setter only — subscribing every line to the whole document
  // here would re-render all N lines on each keystroke.
  const setDoc = useSetAtom(docAtom)
  const [requestFocusLine, setRequestFocusLine] = useAtom(requestFocusLineAtom)
  const setFocusedLine = useSetAtom(focusedLineAtom)
  const store = useStore()

  // Mutable ref so CodeMirror closures always read the current lineIdx,
  // even after drag-and-drop reordering changes the index without remounting.
  const lineIdxRef = useRef(lineInfo.lineIdx)
  lineIdxRef.current = lineInfo.lineIdx
  const getLineIdx = () => lineIdxRef.current

  const makeEditor = () => {
    if (!cmRef.current) return

    const { keymap: customKeymap, undoRedoHandler } = makeKeymap(
      store,
      getLineIdx
    )

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return
      }

      if (
        update.transactions.some((t) => t.annotation(externalSyncAnnotation))
      ) {
        return
      }

      setDoc((draft) => {
        draft.children[getLineIdx()].mdContent = update.state.doc.toString()
        draft.children[getLineIdx()].timeUpdated = new Date().toISOString()
      })
    })

    const focusListener = EditorView.updateListener.of((update) => {
      // Runs after updateListener, so undo capture during a typing
      // transaction reads the pre-keystroke cursor position.
      if (update.selectionSet && update.view.hasFocus) {
        store.set(focusedPosAtom, update.state.selection.main.head)
      }
      if (!update.focusChanged) return
      if (update.view.hasFocus) {
        setFocusedLine(getLineIdx())
        store.set(focusedPosAtom, update.state.selection.main.head)
      }
    })

    const extensions: Extension[] = [
      theme,
      undoRedoHandler,
      updateListener,
      focusListener,
      customKeymap,
      keymap.of(emacsStyleKeymap),
      EditorView.lineWrapping,
      syntaxPlugin,
      autocompletion({
        icons: false,
        optionClass: () => 'tekne-completion',
        override: [
          slashCommandsPlugin(getLineIdx, store),
          tagCompletionPlugin(store),
        ],
      }),
    ]

    const state = EditorState.create({
      doc: lineInfo.line.mdContent,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: cmRef.current,
    })

    cmView.current = view

    return () => {
      view.destroy()
      // Null the ref so nothing (e.g. the focus-request effect) mistakes a
      // destroyed view for a live one across StrictMode's remount cycle.
      if (cmView.current === view) {
        cmView.current = null
      }
    }
  }

  // Depend on content so unrelated changes to the props object do not trigger sync.
  const mdContent = lineInfo.line.mdContent
  useLayoutEffect(() => {
    const v = cmView.current
    if (!v) return

    if (v.state.doc.toString() !== mdContent) {
      v.dispatch({
        changes: {
          from: 0,
          to: v.state.doc.length,
          insert: mdContent,
        },
        annotations: [externalSyncAnnotation.of(true)],
      })
    }
  }, [mdContent])

  // Sets up new editor on mount
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(makeEditor, [])

  const lineIdx = lineInfo.lineIdx
  useEffect(() => {
    if (requestFocusLine.lineIdx !== lineIdx) {
      return
    }

    // Retry if the view is unavailable; cancel pending retries on unmount.
    let retry: ReturnType<typeof setTimeout> | null = null

    const obtainFocus = () => {
      // Outside a touch editing session, select without raising the keyboard.
      // During editing, move the session to the requested line.
      if (getDisplayMode() === 'touch') {
        const line = store.get(docAtom).children[lineIdx]
        if (line) {
          if (store.get(touchEditingLineIdAtom) === null) {
            store.set(touchSelectedLineIdAtom, line.id)
            setRequestFocusLine({ lineIdx: -1, pos: 0 })
            return
          }
          store.set(touchEditingLineIdAtom, line.id)
          store.set(touchSelectedLineIdAtom, line.id)
        }
      }

      const view = cmView.current

      if (!view) {
        retry = setTimeout(obtainFocus, 10)
        return
      }

      view.focus()
      view.dispatch({
        selection: EditorSelection.cursor(requestFocusLine.pos),
        scrollIntoView: true,
      })

      setRequestFocusLine({
        lineIdx: -1,
        pos: 0,
      })
    }

    obtainFocus()

    return () => {
      if (retry !== null) clearTimeout(retry)
    }
  }, [requestFocusLine, lineIdx, setRequestFocusLine, store])

  // Slash-command collapse needs this view; other events use useDocumentLineEvents.
  useLineEvent('lineCollapseToggle', lineInfo.lineIdx, () => {
    const view = cmView.current
    if (view) {
      toggleCollapse(view, store, lineInfo.lineIdx)
    }
  })

  return {
    cmRef,
    cmView,
  }
}
