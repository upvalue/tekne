import { afterEach, expect, test, vi } from 'vitest'
import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createStore } from 'jotai'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom } from '../state'
import { slashCommandsPlugin } from './slash-commands-plugin'
import { startTimer } from '../timer/timer-controller'

vi.mock('../timer/timer-controller', () => ({ startTimer: vi.fn() }))
const views: EditorView[] = []
afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  vi.clearAllMocks()
})
const setup = (text: string) => {
  const store = createStore()
  store.set(docAtom, docMake([lineMake(0, text, { datumTimeSeconds: 600 })]))
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            store.set(docAtom, (draft) => {
              draft.children[0].mdContent = update.state.doc.toString()
            })
        }),
      ],
    }),
  })
  views.push(view)
  const result = slashCommandsPlugin(
    () => 0,
    store
  )(new CompletionContext(view.state, text.length, false))
  const apply = (label: string) => {
    const option = result!.options.find((option) =>
      option.label.startsWith(label)
    )!
    if (typeof option.apply === 'function')
      option.apply(view, option, result!.from, text.length)
  }
  return { store, view, result, apply }
}

test('a slash alone offers all six commands with previews, but not inside tags or URLs', () => {
  const { result } = setup('/')
  expect(result?.options).toHaveLength(6)
  expect(result?.options.every((option) => option.detail)).toBe(true)
  expect(setup('#project/').result).toBeNull()
  expect(setup('https://').result).toBeNull()
})

test('countdown uses the supplied duration and removes the command before starting', () => {
  const { store, apply } = setup('Write tutorial #tekne /countdown 1h 20m')
  apply('/countdown')
  expect(startTimer).toHaveBeenCalledWith(
    store,
    expect.objectContaining({
      targetDuration: 4800,
      mode: 'countdown',
      line: expect.objectContaining({ mdContent: 'Write tutorial #tekne ' }),
    })
  )
})

test('log adds to recorded time, while task keeps existing text and time', () => {
  const log = setup('Work /log 45m')
  log.apply('/log')
  expect(log.store.get(docAtom).children[0]).toMatchObject({
    mdContent: 'Work ',
    datumTimeSeconds: 3300,
  })
  const task = setup('Work /task')
  task.apply('/task')
  expect(task.store.get(docAtom).children[0]).toMatchObject({
    mdContent: 'Work ',
    datumTimeSeconds: 600,
    datumTaskStatus: 'unset',
  })
})

test('date inserts the date in place of the slash command', () => {
  const { view, apply } = setup('Due /date')
  apply('/date')
  expect(view.state.doc.toString()).toMatch(/^Due \d{4}-\d{2}-\d{2}$/)
})
