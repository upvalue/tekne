import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, expect, test } from 'vitest'
import { placeholder } from './placeholder-plugin'

const views: EditorView[] = []
const createView = (doc: string, extension: Extension) => {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [extension] }),
  })
  views.push(view)
  return view
}

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
})

test('renders function content immediately with the default visibility', () => {
  const view = createView(
    '',
    placeholder(() => 'The world is your canvas')
  )
  const widget = view.dom.querySelector('.cm-placeholder')

  expect(widget?.textContent).toBe('The world is your canvas')
  expect(widget?.getAttribute('aria-hidden')).toBe('true')
})

test('rebuilds the placeholder at the document end after successive edits', () => {
  const view = createView(
    'a',
    placeholder((view) => ` [${view.state.doc.length}]`)
  )
  expect(view.dom.querySelector('.cm-line')?.textContent).toBe('a [1]')

  view.dispatch({ changes: { from: 1, insert: 'bc' } })
  expect(view.dom.querySelector('.cm-line')?.textContent).toBe('abc [3]')

  view.dispatch({ changes: { from: 0, to: 3, insert: 'd' } })
  expect(view.dom.querySelector('.cm-line')?.textContent).toBe('d [1]')
})

test('hides and restores the placeholder as its visibility predicate changes', () => {
  const view = createView(
    '',
    placeholder(
      () => 'Start writing',
      (view) => view.state.doc.length === 0
    )
  )
  expect(view.dom.querySelector('.cm-placeholder')?.textContent).toBe(
    'Start writing'
  )

  view.dispatch({ changes: { from: 0, insert: 'text' } })
  expect(view.dom.querySelector('.cm-placeholder')).toBeNull()

  view.dispatch({ changes: { from: 0, to: 4 } })
  expect(view.dom.querySelector('.cm-placeholder')?.textContent).toBe(
    'Start writing'
  )
})
