import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { createStore } from 'jotai'
import { describe, expect, test } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom } from '../state'
import { makeKeymap } from './line-operations'

describe('Enter', () => {
  test('splits the document updated by the CodeMirror change listener', () => {
    const store = createStore()
    store.set(docAtom, docMake([lineMake(0, 'Test1Test2')]))

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      store.set(docAtom, (draft) => {
        draft.children[0].mdContent = update.state.doc.toString()
      })
    })
    const lineKeymap = makeKeymap(store, () => 0).keymap
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Test1Test2',
        selection: { anchor: 'Test1'.length },
        extensions: [updateListener, lineKeymap],
      }),
    })

    const enter = view.state
      .facet(keymap)
      .flat()
      .find((binding) => binding.key === 'Enter')

    expect(enter?.run?.(view)).toBe(true)
    expect(store.get(docAtom).children.map((line) => line.mdContent)).toEqual([
      'Test1',
      'Test2',
    ])

    view.destroy()
  })
})
