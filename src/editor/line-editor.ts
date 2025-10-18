// line-editor.ts - Meat of the actual editor implementation
// Wraps Codemirror with lots of custom behavior
import { useEffect, useRef } from 'react'

import { EditorView, keymap } from '@codemirror/view'
import { emacsStyleKeymap } from '@codemirror/commands'
import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { type ZLine } from '@/docs/schema'
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import {
  docAtom,
  focusedLineAtom,
  globalTimerAtom,
  requestFocusLineAtom,
} from './state'
import { autocompletion } from '@codemirror/autocomplete'
import { useLineEvent } from './line-editor/cm-events'
import { slashCommandsPlugin } from './line-editor/slash-commands-plugin'
import { placeholder } from './line-editor/placeholder-plugin'
import { makeKeymap, toggleCollapse } from './line-editor/line-operations'
import { syntaxPlugin } from './line-editor/syntax-plugin'
import { tagCompletionPlugin } from './line-editor/tag-completion-plugin'

const theme = EditorView.theme(
  // Preferring to do these in TEditor.css
  // but due to the css-in-js approach in some cases
  // it's challenging
  {
    '.cm-completionIcon': {
      display: 'none',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-focused': {
      outline: 'none',
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
  const [, setDoc] = useAtom(docAtom)
  const [requestFocusLine, setRequestFocusLine] = useAtom(requestFocusLineAtom)
  const setFocusedLine = useSetAtom(focusedLineAtom)
  const store = useStore()

  //
  const makeEditor = () => {
    const { keymap: customKeymap, cleanup: cleanupKeymap } = makeKeymap(
      store,
      lineInfo.lineIdx
    )

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return
      }

      console.log(
        'Line',
        lineInfo.lineIdx,
        'content updated',
        update.state.doc.toString()
      )
      setDoc((draft) => {
        draft.children[lineInfo.lineIdx].mdContent = update.state.doc.toString()
        draft.children[lineInfo.lineIdx].timeUpdated = new Date().toISOString()
      })
    })

    const focusListener = EditorView.updateListener.of((update) => {
      if (!update.focusChanged) return
      if (update.view.hasFocus) {
        setFocusedLine(lineInfo.lineIdx)
        // state.update({annotations: isActive.of(true) });
      } else {
        // state.update({annotations: isActive.of(false)});
      }
    })

    // Placeholder plugin: renders some grayed out text under
    // certain circumstances
    const placeholderPlugin = placeholder(
      () => {
        const line = store.get(docAtom).children[lineInfo.lineIdx]
        if (!line) return ''
        if (store.get(docAtom).children[lineInfo.lineIdx].collapsed)
          return ' + collasped lines'
        return 'The world is your canvas'
      },
      (view) => {
        // If line is collapsed, we show a placeholder indicating collapsed line details
        const doc = store.get(docAtom)

        if (!doc || !doc.children || !doc.children[lineInfo.lineIdx])
          return false
        if (doc.children[lineInfo.lineIdx].collapsed) return true

        // Don't show placeholder if:
        // There's any content on the line
        if (view.state.doc.length > 0) return false

        // This isn't the first line of the doc
        if (lineInfo.lineIdx !== 0) return false

        // There's more than one line in the doc
        if (doc.children.length > 1) return false

        // Otherwise, do show the placeholder
        return true
      }
    )

    const extensions: Extension[] = [
      theme,
      updateListener,
      focusListener,
      customKeymap,
      keymap.of(emacsStyleKeymap),
      EditorView.lineWrapping,
      syntaxPlugin,
      placeholderPlugin,
      autocompletion({
        override: [
          slashCommandsPlugin(lineInfo.lineIdx),
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
      parent: cmRef.current!,
    })

    cmView.current = view

    return () => {
      cleanupKeymap()
      view.destroy()
    }
  }

  // This handles taking external updates, which might happen if e.g.
  // a user deletes a line, the remaining text is appending to the previous
  // updates. In this case I've found it best to just destroy and recreate
  // codemirror.
  useEffect(() => {
    if (!cmView.current) return
    const { line } = lineInfo

    const v = cmView.current

    // When the document itself is updated, we need to synchronize
    // React state with Codemirror state
    if (v.state.doc.toString() !== line.mdContent) {
      console.log('Line changed externally, updating', lineInfo.lineIdx)
      cmView.current?.destroy()
      makeEditor()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineInfo])

  /**
   * Focus management.
   *
   * Lines can request focus on a specific line / position due to
   * line editing operations. This effect determines when that's happened,
   * loops until Codemirror is ready to handle it, and then does so
   */
  useEffect(() => {
    const { lineIdx } = lineInfo

    if (requestFocusLine.lineIdx !== lineIdx) {
      return
    }

    console.log('Focus requested on line ', lineIdx, ' view ', cmView.current)

    const obtainFocus = () => {
      const view = cmView.current

      if (!view) {
        console.log('Focus: View not defined, returning early')
        setTimeout(obtainFocus, 10)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFocusLine, lineInfo, cmView.current])

  // Sets up new editor on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(makeEditor, [])

  // Line specific events, emitted by the event
  // emitter. Could probably be moved one level up.
  useLineEvent('lineTimerToggle', lineInfo.lineIdx, (event) => {
    const globalTimer = store.get(globalTimerAtom)
    setDoc((draft) => {
      const datumTimeSeconds = draft.children[event.lineIdx].datumTimeSeconds
      if (datumTimeSeconds !== undefined) {
        if (datumTimeSeconds > 0) {
          if (confirm('Timer has data, do you want to remove it?')) {
            if (globalTimer.lineIdx === event.lineIdx) {
              globalTimer.stopTimer()
            }
            delete draft.children[event.lineIdx].datumTimeSeconds
          }
        }
      } else {
        draft.children[event.lineIdx].datumTimeSeconds = 0
      }
    })
  })

  useLineEvent('linePinToggle', lineInfo.lineIdx, (event) => {
    setDoc((draft) => {
      if (draft.children[event.lineIdx].datumPinnedAt) {
        delete draft.children[event.lineIdx].datumPinnedAt
      } else {
        draft.children[event.lineIdx].datumPinnedAt = new Date().toISOString()
      }
    })
  })

  useLineEvent('lineTaskToggle', lineInfo.lineIdx, (event) => {
    setDoc((draft) => {
      if (draft.children[event.lineIdx].datumTaskStatus) {
        delete draft.children[event.lineIdx].datumTaskStatus
      } else {
        draft.children[event.lineIdx].datumTaskStatus = 'unset'
      }
    })

    console.log('Tag toggle event', event.lineIdx)
  })

  // Line collapse toggle -- note that this only handles
  // the slash command, there is also a separate
  // key binding
  useLineEvent('lineCollapseToggle', lineInfo.lineIdx, () => {
    const view = cmView.current
    if (view) {
      toggleCollapse(view, store, lineInfo.lineIdx)
    }
  })

  useLineEvent('lineColorChange', lineInfo.lineIdx, (event) => {
    setDoc((draft) => {
      if (event.color === null) {
        delete draft.children[event.lineIdx].color
      } else {
        draft.children[event.lineIdx].color = event.color
      }
    })
  })

  return {
    cmRef,
    cmView,
  }
}
