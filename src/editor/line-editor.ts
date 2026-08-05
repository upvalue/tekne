// line-editor.ts - Meat of the actual editor implementation
// Wraps Codemirror with lots of custom behavior
import { useEffect, useRef } from 'react'

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
import { placeholder } from './line-editor/placeholder-plugin'
import { makeKeymap, toggleCollapse } from './line-editor/line-operations'
import { syntaxPlugin } from './line-editor/syntax-plugin'
import { tagCompletionPlugin } from './line-editor/tag-completion-plugin'

/**
 * Annotation used to mark CodeMirror transactions that come from
 * external sync (e.g. undo/redo restoring document state).
 * The updateListener skips these to prevent echo writes.
 */
export const externalSyncAnnotation = Annotation.define<boolean>()

const theme = EditorView.theme(
  // Preferring to do these in TEditor.css
  // but due to the css-in-js approach in some cases
  // it's challenging
  {
    ...baseLineThemeSpec,
    '.cm-completionIcon': {
      display: 'none',
    },
  },
  { dark: true }
)

export { useCodemirrorEvent, useLineEvent } from './line-editor/cm-events'

/**
 * Line with its index. Handy for being able to
 * change the document without knowing its structure:
 */
export type LineWithIdx = {
  line: ZLine
  lineIdx: number
}

/**
 * Sets up a Codemirror editor
 *
 * How the Codemirror integration works currently.
 *
 * The hook returns a ref which the component for the actual line
 * gives to the div where Codemirror will be set up.
 *
 * On hook mount, a Codemirror view is set up with the markdown content of the line
 *
 * There's bidirectional synchronization of codemirror view and document state;
 * updates to codemirror update the document, and updates to the document update
 * codemirror (if there are any changes). This is because lines can alter the state
 * of other lines (for example, if a line is deleted via backspace, the content of that
 * line is spliced onto the previous line). This probably shouldn't work... but it seems
 * to work fine.
 *
 * It's probable that https://github.com/uiwjs/react-codemirror should be used
 * instead of this hand rolled thing, but I wanted to use vanilla codemirror because
 * various prosemirror wrappers became very confusing.
 */
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

  //
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

      // Skip echoed writes from external sync (undo/redo restores)
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
        // state.update({annotations: isActive.of(true) });
      } else {
        // state.update({annotations: isActive.of(false)});
      }
    })

    // Placeholder plugin: renders some grayed out text under
    // certain circumstances
    const placeholderPlugin = placeholder(
      () => {
        const idx = getLineIdx()
        const line = store.get(docAtom).children[idx]
        if (!line) return ''
        if (line.collapsed) return ' + collapsed lines'
        return 'The world is your canvas'
      },
      (view) => {
        // If line is collapsed, we show a placeholder indicating collapsed line details
        const doc = store.get(docAtom)
        const idx = getLineIdx()

        if (!doc || !doc.children || !doc.children[idx]) return false
        if (doc.children[idx].collapsed) return true

        // Don't show placeholder if:
        // There's any content on the line
        if (view.state.doc.length > 0) return false

        // This isn't the first line of the doc
        if (idx !== 0) return false

        // There's more than one line in the doc
        if (doc.children.length > 1) return false

        // Otherwise, do show the placeholder
        return true
      }
    )

    const extensions: Extension[] = [
      theme,
      undoRedoHandler,
      updateListener,
      focusListener,
      customKeymap,
      keymap.of(emacsStyleKeymap),
      EditorView.lineWrapping,
      syntaxPlugin,
      placeholderPlugin,
      autocompletion({
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

  // This handles taking external updates, which might happen if e.g.
  // a user deletes a line, the remaining text is appending to the previous
  // updates. Depending on the content string (not the props object, whose
  // identity changes every parent render) means the comparison below only
  // runs when this line's content actually changed.
  const mdContent = lineInfo.line.mdContent
  useEffect(() => {
    const v = cmView.current
    if (!v) return

    // When the document itself is updated, we need to synchronize
    // React state with Codemirror state
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

  /**
   * Focus management.
   *
   * Lines can request focus on a specific line / position due to
   * line editing operations. This effect determines when that's happened,
   * loops until Codemirror is ready to handle it, and then does so
   */
  const lineIdx = lineInfo.lineIdx
  useEffect(() => {
    if (requestFocusLine.lineIdx !== lineIdx) {
      return
    }

    // CodeMirror may not be mounted yet (the editor-creation effect runs
    // after this one on mount), so retry until it is — and cancel the retry
    // loop if the line unmounts first.
    let retry: ReturnType<typeof setTimeout> | null = null

    const obtainFocus = () => {
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

      // Clear line focus status
      setRequestFocusLine({
        lineIdx: -1,
        pos: 0,
      })
    }

    obtainFocus()

    return () => {
      if (retry !== null) clearTimeout(retry)
    }
  }, [requestFocusLine, lineIdx, setRequestFocusLine])

  // Sets up new editor on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(makeEditor, [])

  // Most line events are handled once at document level (see
  // useDocumentLineEvents); collapse stays here because it needs this
  // line's CodeMirror view. Note that this only handles the slash
  // command — there is also a separate key binding.
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
