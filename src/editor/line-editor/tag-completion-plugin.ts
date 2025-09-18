import { useStore } from 'jotai'
import { allTagsAtom } from '../state'
import { TagRegexMatchBefore } from '../regex'
import { CompletionContext } from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import type { Completion } from '@codemirror/autocomplete'

export const tagCompletionPlugin =
  (store: ReturnType<typeof useStore>) => (context: CompletionContext) => {
    const word = context.matchBefore(TagRegexMatchBefore)

    if (!word) return null
    if (word.from === word.to && !context.explicit) return null

    const { data } = store.get(allTagsAtom)

    if (!data || !Array.isArray(data)) return null

    const options = data.map((tag) => ({
      label: `#${tag}`,
      type: 'text',
      apply: (
        view: EditorView,
        _completion: Completion,
        from: number,
        to: number
      ) => {
        view.dispatch({
          changes: {
            from,
            to,
            insert: `#${tag}`,
          },
        })
      },
    }))

    return {
      from: word.from,
      options,
    }
  }
