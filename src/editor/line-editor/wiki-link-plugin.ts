import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type PluginValue,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const wikiLinkPattern = /\[\[(.*?)\]\]/g

const makeWikiLinkDecoration = (link: string) => {
  const linkText = link.slice(2, -2)
  return Decoration.mark({
    class: 'cm-wiki-link',
    tagName: 'span',
    attributes: {
      'data-link': linkText,
      onClick: `window.__codemirrorEmitter.emit('wikiLinkClick', { link: "${linkText}" })`,
    },
  })
}

/**
 * WikiLink plugin, handles decorating and clicking on [[WikiLinks]]
 */
export const wikiLinkPlugin = ViewPlugin.fromClass(
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

        wikiLinkPattern.lastIndex = 0
        while ((match = wikiLinkPattern.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          console.log('add decoration for', match[0])
          builder.add(start, end, makeWikiLinkDecoration(match[0]))
        }
      }

      return builder.finish()
    }
  },
  {
    decorations: (value) => value.decorations,
  }
)
