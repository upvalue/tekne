import { EditorView } from '@codemirror/view'
import { type Completion, CompletionContext } from '@codemirror/autocomplete'
import { emitCodemirrorEvent } from './cm-events'
import type { LineColor } from '@/docs/schema'

const colorCommand = (lineIdx: number, color: LineColor) => ({
  label: `/${color}: Set line background to ${color}`,
  type: 'text' as const,
  apply: (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number
  ) => {
    emitCodemirrorEvent('lineColorChange', {
      lineIdx,
      color,
    })

    view.dispatch({
      changes: {
        from,
        to,
        insert: '',
      },
    })
  },
})

const noColorCommand = (lineIdx: number) => ({
  label: '/nocolor: Remove line background color',
  type: 'text' as const,
  apply: (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number
  ) => {
    emitCodemirrorEvent('lineColorChange', {
      lineIdx,
      color: null,
    })

    view.dispatch({
      changes: {
        from,
        to,
        insert: '',
      },
    })
  },
})

export const slashCommandsPlugin = (lineIdx: number) => {
  return (context: CompletionContext) => {
    const word = context.matchBefore(/\/\w*/)
    if (!word) return null
    if (word.from == word.to && !context.explicit) return null

    return {
      from: word.from,
      options: [
        {
          label: '/date: Insert current date',
          type: 'text',
          apply: (
            view: EditorView,
            _completion: Completion,
            from: number,
            to: number
          ) => {
            const date = new Date().toISOString().split('T')[0]

            view.dispatch({
              changes: {
                from,
                to,
                insert: date,
              },
            })
          },
        },
        {
          label: '/pin: Toggle whether line is pinned',
          type: 'text',
          apply: (
            view: EditorView,
            _completion: Completion,
            from: number,
            to: number
          ) => {
            emitCodemirrorEvent('linePinToggle', {
              lineIdx,
            })

            view.dispatch({
              changes: {
                from,
                to,
                insert: '',
              },
            })
          },
        },
        {
          label: '/timer: Add a timer to the line',
          type: 'text',
          apply: (
            view: EditorView,
            _completion: Completion,
            from: number,
            to: number
          ) => {
            emitCodemirrorEvent('lineTimerAdd', {
              lineIdx,
            })

            view.dispatch({
              changes: {
                from,
                to,
                insert: '',
              },
            })
          },
        },
        {
          label: '/task: Toggle whether line is a task',
          type: 'text',
          apply: (
            view: EditorView,
            _completion: Completion,
            from: number,
            to: number
          ) => {
            emitCodemirrorEvent('lineTaskToggle', {
              lineIdx,
            })

            view.dispatch({
              changes: {
                from,
                to,
                insert: '',
              },
            })
          },
        },
        {
          label: '/collapse: Toggle whether line is collapsed',
          type: 'text',
          apply: (
            view: EditorView,
            _completion: Completion,
            from: number,
            to: number
          ) => {
            emitCodemirrorEvent('lineCollapseToggle', {
              lineIdx,
            })

            view.dispatch({
              changes: {
                from,
                to,
                insert: '',
              },
            })
          },
        },
        /*
        colorCommand(lineIdx, 'red'),
        colorCommand(lineIdx, 'yellow'),
        colorCommand(lineIdx, 'blue'),
        colorCommand(lineIdx, 'purple'),
        colorCommand(lineIdx, 'green'),
        noColorCommand(lineIdx),*/
      ],
    }
  }
}
