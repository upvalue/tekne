// line-operations.ts - line operations and key bindings.
// The document transformations themselves live in line-mutations.ts; this
// file is the CodeMirror keymap layer that reads editor state, applies a
// mutation, and requests focus.
import { keymap, EditorView } from '@codemirror/view'
import { docAtom, requestFocusLineAtom } from '../state'
import { undo, redo } from '../undo'
import { type ZDoc } from '@/docs/schema'
import { codeMirrorKey } from '@/lib/keys'
import type { useStore } from 'jotai'
import { getDefaultStore } from 'jotai'
import { Transaction } from '@codemirror/state'
import {
  canIndentLine,
  dropFirstLine,
  indentLine,
  mergeIntoPreviousLine,
  outdentLine,
  removeLine,
  splitLine,
} from './line-mutations'

/** Delete an entire line by index, moving focus to the previous line.
 *  If it's the last remaining line, clears its content instead. */
export const deleteLine = (
  lineIdx: number,
  store?: ReturnType<typeof useStore>
) => {
  const s = store ?? getDefaultStore()
  const { doc, focus } = removeLine(s.get(docAtom), lineIdx)

  if (focus) {
    s.set(requestFocusLineAtom, focus)
  }
  s.set(docAtom, doc)
}

export const toggleCollapse = (
  view: EditorView,
  store: ReturnType<typeof useStore>,
  lineIdx: number
) => {
  const setDoc = (updater: (draft: ZDoc) => void) => store.set(docAtom, updater)
  const doc = store.get(docAtom)

  const nextLine = doc.children[lineIdx + 1]
  if (!nextLine || nextLine.indent <= doc.children[lineIdx].indent) {
    return false
  }

  setDoc((draft: ZDoc) => {
    if (draft.children[lineIdx].collapsed) {
      delete draft.children[lineIdx].collapsed
    } else {
      draft.children[lineIdx].collapsed = true
    }
  })

  view.dispatch({
    annotations: [Transaction.userEvent.of('tekne-lineCollapseToggle')],
  })

  return true
}

export const makeKeymap = (
  store: ReturnType<typeof useStore>,
  getLineIdx: () => number
) => {
  // Read the document lazily per keystroke instead of mirroring it into a
  // local via a per-line store subscription.
  const getDoc = () => store.get(docAtom)

  const setRequestFocusLine = (value: { lineIdx: number; pos: number }) =>
    store.set(requestFocusLineAtom, value)

  const deleteLineIfEmpty = (view: EditorView) => {
    const doc = getDoc()
    const lineIdx = getLineIdx()
    const { state } = view
    const { selection } = state
    const { ranges } = selection

    if (ranges.length === 0) return false

    const r = ranges[0]

    if (r.from === 0 && r.to === 0) {
      if (lineIdx === 0) {
        const next = dropFirstLine(doc)
        if (next === null) {
          return false
        }

        setRequestFocusLine({ lineIdx: 0, pos: 0 })
        store.set(docAtom, next)
        return true
      }

      const merged = mergeIntoPreviousLine(
        doc,
        lineIdx,
        state.doc.slice(0, state.doc.length).toString()
      )
      setRequestFocusLine(merged.focus)
      store.set(docAtom, merged.doc)
      return true
    }

    return false
  }

  const keymapExtension = keymap.of([
    {
      key: 'Tab',
      run: () => {
        const doc = getDoc()
        const lineIdx = getLineIdx()
        if (!canIndentLine(doc, lineIdx)) return false

        store.set(docAtom, indentLine(doc, lineIdx))
        return true
      },
    },
    {
      key: 'Enter',
      run: (view) => {
        const doc = getDoc()
        const lineIdx = getLineIdx()
        const { state } = view
        const { selection } = state

        const docEnd = state.doc.length
        const currentLineContent = state.doc.toString()

        // Enter on an empty indented line outdents it instead of splitting
        if (
          currentLineContent.trim() === '' &&
          doc.children[lineIdx].indent > 0
        ) {
          const outdented = outdentLine(doc, lineIdx)
          if (outdented) {
            store.set(docAtom, outdented)
          }
          return true
        }

        // The text after the cursor (or after the selection) moves to the
        // new line; a selection is deleted with the split.
        const from = selection.main.empty
          ? selection.main.anchor
          : selection.main.from
        const to = selection.main.empty ? from : selection.main.to
        const remainder = state.doc.slice(to, docEnd).toString()

        view.dispatch({
          changes: {
            from,
            to: docEnd,
            insert: '',
          },
        })

        setRequestFocusLine({
          lineIdx: lineIdx + 1,
          pos: 0,
        })
        store.set(docAtom, splitLine(doc, lineIdx, remainder))

        return true
      },
    },
    {
      key: 'Shift-Tab',
      run: () => {
        const next = outdentLine(getDoc(), getLineIdx())
        if (next === null) {
          return false
        }
        store.set(docAtom, next)
        return true
      },
    },
    {
      key: 'Backspace',
      run: (view) => deleteLineIfEmpty(view),
    },
    {
      key: 'ArrowUp',
      run: (view) => {
        const doc = getDoc()
        const lineIdx = getLineIdx()
        const cursorPos = view.state.selection.main.head

        if (lineIdx === 0) return false

        const prevLine = doc.children[lineIdx - 1]

        setRequestFocusLine({
          lineIdx: lineIdx - 1,
          pos: Math.min(cursorPos, prevLine.mdContent.length),
        })

        return true
      },
    },
    {
      key: 'ArrowDown',
      run: (view) => {
        const doc = getDoc()
        const lineIdx = getLineIdx()
        const cursorPos = view.state.selection.main.head

        if (lineIdx >= doc.children.length - 1) return false

        const nextLine = doc.children[lineIdx + 1]

        setRequestFocusLine({
          lineIdx: lineIdx + 1,
          pos: Math.min(cursorPos, nextLine.mdContent.length),
        })

        return true
      },
    },
    {
      key: 'Mod-Backspace',
      run: (view) => deleteLineIfEmpty(view),
    },
    {
      key: codeMirrorKey('toggleCollapse'),
      run: (view) => toggleCollapse(view, store, getLineIdx()),
    },
    {
      key: 'Alt-Backspace',
      run: (view) => deleteLineIfEmpty(view),
    },
    {
      key: codeMirrorKey('deleteLine'),
      run: () => {
        deleteLine(getLineIdx(), store)
        return true
      },
    },
  ])

  // Undo/redo uses domEventHandlers instead of keymap bindings because
  // CM's Mod-z matches both Ctrl+Z and Ctrl+Shift+Z on Linux
  const undoRedoHandler = EditorView.domEventHandlers({
    keydown: (event) => {
      if (!(event.ctrlKey || event.metaKey)) return false
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo(store)
        } else {
          undo(store)
        }
        return true
      }
      if (key === 'y') {
        event.preventDefault()
        redo(store)
        return true
      }
      return false
    },
  })

  return {
    keymap: keymapExtension,
    undoRedoHandler,
  }
}
