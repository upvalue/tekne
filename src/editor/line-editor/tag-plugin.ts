import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type PluginValue,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { tagPattern } from '../doc-analysis'

const makeTagDecoration = (tag: string) => {
  return Decoration.mark({
    class: 'cm-tag cursor-pointer',
    tagName: 'span',
    attributes: {
      'data-name': tag,
      onClick: `window.__codemirrorEmitter.emit('tagClick', { name: "${tag}" })`,
    },
  })
}

export const tagPlugin = ViewPlugin.fromClass(
  class implements PluginValue {
    decorations = Decoration.none

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>()

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match: RegExpExecArray | null

        tagPattern.lastIndex = 0
        while ((match = tagPattern.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          builder.add(start, end, makeTagDecoration(match[0]))
        }
      }

      return builder.finish()
    }
  },
  {
    decorations: (value) => value.decorations,
  }
)
