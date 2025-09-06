// line-operations.ts - line operations and key bindings
import { keymap, EditorView } from '@codemirror/view'
import { docAtom, requestFocusLineAtom } from '../state'
import { lineMake, type ZDoc } from '../schema'
import { keybindings } from '@/lib/keys'
import type { useStore } from 'jotai'
import { Transaction } from '@codemirror/state'

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
  lineIdx: number
) => {
  let doc = store.get(docAtom)
  const unsubscribe = store.sub(docAtom, () => {
    doc = store.get(docAtom)
  })

  const setRequestFocusLine = (value: { lineIdx: number; pos: number }) =>
    store.set(requestFocusLineAtom, value)
  const setDoc = (updater: (draft: ZDoc) => void) => store.set(docAtom, updater)

  const deleteLineIfEmpty = (view: EditorView) => {
    const { state } = view
    const { selection } = state
    const { ranges } = selection

    if (ranges.length === 0) return false

    const r = ranges[0]

    if (r.from === 0 && r.to === 0) {
      if (lineIdx === 0) {
        if (doc.children.length === 1) {
          return false
        }

        setRequestFocusLine({
          lineIdx: lineIdx,
          pos: 0,
        })

        setDoc((draft: ZDoc) => {
          draft.children = draft.children.slice(1)
        })
        return true
      }

      const prevLine = doc.children[lineIdx - 1]

      const endOfPrevLine = prevLine.mdContent.length

      setRequestFocusLine({
        lineIdx: lineIdx - 1,
        pos: endOfPrevLine,
      })

      setDoc((draft: ZDoc) => {
        draft.children[lineIdx - 1].mdContent = prevLine.mdContent.concat(
          state.doc.slice(0, state.doc.length).toString()
        )

        draft.children.splice(lineIdx, 1)
      })
      return true
    }

    return false
  }

  const keymapExtension = keymap.of([
    {
      key: 'Tab',
      run: () => {
        if (lineIdx === 0) return false

        if (
          lineIdx > 0 &&
          doc.children[lineIdx].indent > doc.children[lineIdx - 1].indent
        ) {
          return false
        }

        setDoc((draft: ZDoc) => {
          draft.children[lineIdx].indent += 1
          draft.children[lineIdx].timeUpdated = new Date().toISOString()
        })
        return true
      },
    },
    {
      key: 'Enter',
      run: (view) => {
        console.log('Enter key pressed')
        const { state } = view
        const { selection } = state

        const docEnd = state.doc.length
        const currentLineContent = state.doc.toString()

        if (
          currentLineContent.trim() === '' &&
          doc.children[lineIdx].indent > 0
        ) {
          setDoc((draft: ZDoc) => {
            draft.children[lineIdx].indent = Math.max(
              0,
              doc.children[lineIdx].indent - 1
            )
          })
          return true
        }

        let newLine = ''

        if (!selection.main.empty) {
          const { from, to } = selection.main

          newLine = state.doc.slice(to, docEnd).toString()

          view.dispatch({
            changes: {
              from,
              to: docEnd,
              insert: '',
            },
          })
        } else {
          const from = selection.main.anchor
          newLine = state.doc.slice(from, docEnd).toString()

          view.dispatch({
            changes: {
              from,
              to: docEnd,
              insert: '',
            },
          })
        }

        console.log('After line addition, setting focus line to', lineIdx + 1)
        setRequestFocusLine({
          lineIdx: lineIdx + 1,
          pos: 0,
        })
        setDoc((draft: ZDoc) => {
          const newLineObj = {
            ...lineMake(doc.children[lineIdx].indent),
            mdContent: newLine,
          }
          if (draft.children[lineIdx].collapsed) {
            delete draft.children[lineIdx].collapsed
          }
          draft.children.splice(lineIdx + 1, 0, newLineObj)
        })

        return true
      },
    },
    {
      key: 'Shift-Tab',
      run: () => {
        if (doc.children[lineIdx].indent === 0) {
          return false
        }
        setDoc((draft: ZDoc) => {
          draft.children[lineIdx].indent -= 1
        })
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
        const cursorPos = view.state.selection.main.head

        if (lineIdx === 0) return false

        const prevLine = doc.children[lineIdx - 1]

        console.log('Set focus line to', lineIdx - 1)
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
      key: keybindings.toggleCollapse.key,
      run: (view) => toggleCollapse(view, store, lineIdx),
    },
    {
      key: 'Alt-Backspace',
      run: (view) => deleteLineIfEmpty(view),
    },
  ])

  return {
    keymap: keymapExtension,
    cleanup: unsubscribe,
  }
}
