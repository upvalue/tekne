// syntax-plugin.ts - handles subset of markdown behavior
// and custom syntax like [[InternalLinks]]
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type PluginValue,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { emitCodemirrorEvent } from './cm-events'
import { TEKNE_MD_PARSER, visitMdTree } from '../parser'

class InternalLinkWidget extends WidgetType {
  constructor(readonly linkText: string) {
    super()
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-internal-link'
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      emitCodemirrorEvent('internalLinkClick', {
        link: this.linkText,
      })
    })
    wrap.appendChild(document.createTextNode(this.linkText))
    return wrap
  }

  ignoreEvent() {
    return false
  }
}

class LinkWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly text: string
  ) {
    super()
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-link'
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.open(this.url, '_blank')
    })
    wrap.appendChild(document.createTextNode(this.text))
    return wrap
  }
}

class TagWidget extends WidgetType {
  constructor(readonly tagName: string) {
    super()
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-tag'
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      emitCodemirrorEvent('tagClick', {
        name: this.tagName,
      })
    })
    wrap.appendChild(document.createTextNode(`#${this.tagName}`))
    return wrap
  }

  ignoreEvent() {
    return false
  }
}

// Table to make the code a bit easier to follow
// Simple string => create a span with that classname
const syntaxTable: {
  [key: string]: string
} = {
  Emphasis: 'cm-italic',
  StrongEmphasis: 'cm-bold',
  Strikethrough: 'cm-strikethrough',
}

/**
 * The syntax plugin handles editor syntax -- implements a subset
 * of Markdown based on the @lezer/markdown parser and some custom
 * extensions to it. Then converts these into decoration marks for
 * rendering and actually servicing functionality (e.g. clickable
 * internal links)
 */
class SyntaxPlugin implements PluginValue {
  decorations = Decoration.none

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.focusChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>()

    const { hasFocus, state } = view
    const src = state.sliceDoc(0, view.state.doc.length)
    const tree = TEKNE_MD_PARSER.parse(src)

    // TODO: Quite a bit of redundant code here that could
    // be simplified

    visitMdTree(tree.topNode, src, 0, (node: any) => {
      const tableEntry = syntaxTable[node.type.name]

      if (tableEntry) {
        builder.add(
          node.from,
          node.to,
          Decoration.mark({
            class: tableEntry,
            tagName: 'span',
          })
        )
      }

      if (node.type.name === 'Link') {
        if (hasFocus) {
          builder.add(
            node.from,
            node.to,
            Decoration.mark({
              class: 'cm-link',
              tagName: 'span',
            })
          )
        } else {
          const urlNode = node.getChild('URL')
          if (urlNode) {
            const url = src.slice(urlNode.from, urlNode.to)
            const linkMarks = node.getChildren('LinkMark')
            let text = url
            try {
              text = src.slice(linkMarks[0].to, linkMarks[1].from)
            } catch {
              // ignore
            }
            builder.add(
              node.from,
              node.to,
              Decoration.widget({
                widget: new LinkWidget(url, text),
              })
            )
          }
        }
      }

      if (node.type.name === 'InternalLink') {
        const linkText = src.slice(node.firstChild.from, node.firstChild.to)
        if (hasFocus) {
          builder.add(
            node.from,
            node.to,
            Decoration.mark({
              class: 'cm-link',
              tagName: 'span',
            })
          )
        } else {
          builder.add(
            node.from,
            node.to,
            Decoration.widget({
              widget: new InternalLinkWidget(linkText),
            })
          )
        }
      }

      if (node.type.name === 'Tag') {
        if (hasFocus) {
          builder.add(
            node.from,
            node.to,
            Decoration.mark({
              class: 'cm-tag',
              tagName: 'span',
            })
          )
        } else {
          builder.add(
            node.from,
            node.to,
            Decoration.widget({
              widget: new TagWidget(src.slice(node.from + 1, node.to)),
            })
          )
        }
      }

      if (node.type.name === 'InlineCode') {
        builder.add(
          node.from,
          node.to,
          Decoration.mark({
            class: 'cm-inline-code',
            tagName: 'span',
          })
        )
      }
    })

    return builder.finish()
  }
}

export const syntaxPlugin = ViewPlugin.fromClass(SyntaxPlugin, {
  decorations: (value) => value.decorations,
})
