import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type PluginValue,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const wikiLinkPattern = /\[\[(.*?)\]\]/g

const makeWikiLinkDecorations = (start: number, end: number, link: string, hasFocus: boolean) => {
  const linkText = link.slice(2, -2)
  const decorations: Decoration[] = [

  ]
  if(hasFocus) {
    return 
  } else {
    return Decoration.replace({
      

    })
  }
}
class WikiLinkPlugin implements PluginValue {
  decorations = Decoration.none

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    console.log('wiki link detected update');
    if (update.docChanged || update.viewportChanged || update.focusChanged) {
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
        console.log('add decoration for', match[0], 'focus state ', view.hasFocus);
        
        // When editor is inactive, hide the [[ 
        if(!view.hasFocus) {
          builder.add(start, start+2, Decoration.replace({}));
        }

        // Add main link decoration which makes the link clickable and highlighted
        const linkText = match[0].slice(2, -2)
        console.log('add main dec');
        builder.add(view.hasFocus ? start : start + 2, view.hasFocus ? end : end - 2, Decoration.mark({
          class: 'cm-wiki-link',
          tagName: 'span',
          attributes: {
            'data-link': linkText,
            onClick: `window.__codemirrorEmitter.emit('wikiLinkClick', { link: "${linkText}" })`,
          },
        }));

        // And hide the ]] 
        if(!view.hasFocus) {
          builder.add(end-2, end, Decoration.replace({}));

        }

      }
    }

    return builder.finish()
  }
}

/**
 * WikiLink plugin, handles decorating and clicking on [[WikiLinks]]
 */
export const wikiLinkPlugin = ViewPlugin.fromClass(
  WikiLinkPlugin,
  {
    decorations: (value) => value.decorations,
  }
)
