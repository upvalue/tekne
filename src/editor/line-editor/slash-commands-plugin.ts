import { EditorView } from '@codemirror/view'
import { type Completion, CompletionContext } from '@codemirror/autocomplete'
import { allCommands } from '@/commands/registry'

const SLASH_COMMAND_REGEX = /\/\w*/

export const slashCommandsPlugin = (lineIdx: number) => {
  return (context: CompletionContext) => {
    const word = context.matchBefore(SLASH_COMMAND_REGEX)
    if (!word) return null
    if (word.from == word.to && !context.explicit) return null

    // Don't trigger inside tags (words starting with #)
    const lineStart = context.state.doc.lineAt(word.from).from
    const beforeSlash = context.state.doc.sliceString(lineStart, word.from)
    if (/#\S*$/.test(beforeSlash)) return null

    // Require at least one character after the slash
    const slashText = context.state.doc.sliceString(word.from, word.to)
    if (slashText.length <= 1) return null

    // Generate completions from command registry
    const editorCommands = allCommands.filter((cmd) => cmd.requiresEditor)

    const options: Completion[] = editorCommands.map((cmd) => ({
      label: `/${cmd.id.replace(/-/g, '')}: ${cmd.name}`,
      type: 'text',
      info: cmd.description,
      apply: (
        view: EditorView,
        _completion: Completion,
        from: number,
        to: number
      ) => {
        // Execute command with editor context
        cmd.execute({
          lineIdx,
          view,
        })

        // Clear the slash command text
        view.dispatch({
          changes: { from, to, insert: '' },
        })
      },
    }))

    return {
      from: word.from,
      options,
    }
  }
}
