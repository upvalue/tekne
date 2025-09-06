import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type PluginValue,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import {
  parser as baseParser,
  type MarkdownConfig,
  Strikethrough,
} from '@lezer/markdown'
import { tags as t } from '@lezer/highlight'
import { emitCodemirrorEvent } from './cm-events'

const LBRACKET_CHAR_CODE = 91

export const InternalLinkRegex = new RegExp('[a-zA-Z0-9]+\]\]')

const InternalLinkConfig: MarkdownConfig = {
  defineNodes: [
    {
      name: 'InternalLink',
      style: t.character,
    },
    {
      name: 'InternalLinkBody',
      style: t.character,
    },
  ],
  parseInline: [
    {
      name: 'InternalLink',
      parse(cx, next, pos) {
        let match: RegExpExecArray | null
        if (next !== LBRACKET_CHAR_CODE) {
          return -1
        }

        // Short circuit if it's not two lbrackets
        if (cx.char(pos + 1) !== LBRACKET_CHAR_CODE) {
          return -1
        }

        match = InternalLinkRegex.exec(cx.slice(pos + 1, cx.end))

        if (match === null) {
          return -1
        }

        return cx.addElement(
          cx.elt('InternalLink', pos, pos + 2 + match[0].length, [
            cx.elt('InternalLinkBody', pos + 2, pos + match[0].length),
          ])
        )
      },
      // TODO: Ordering is pretty important here, we probably
      // want InternalLink to take precedence over everything
      // (e.g. internallinks can't contain Markdown)
      // But for now this is probably fine
      before: 'Link',
    },
  ],
}

const POUND_CHAR_CODE = 35

export const TagRegex = new RegExp('^[a-zA-Z][a-zA-Z0-9-]*(?=\\s|$)')

const TagConfig: MarkdownConfig = {
  defineNodes: [
    {
      name: 'Tag',
      style: t.character,
    },
  ],
  parseInline: [
    {
      name: 'Tag',
      parse(cx, next, pos) {
        if (next !== POUND_CHAR_CODE) {
          return -1
        }

        const match = TagRegex.exec(cx.slice(pos + 1, cx.end))

        if (match === null) {
          return -1
        }

        return cx.addElement(cx.elt('Tag', pos, pos + 1 + match[0].length))
      },
    },
  ],
}

const parser = baseParser.configure([
  InternalLinkConfig,
  TagConfig,
  Strikethrough,
  {
    // For now, we don't support most Markdown stuff.

    // Partly because some of the functionality is redundant
    // with the top level editor (lists) and won't be added

    // Other stuff just not supported yet
    remove: [
      'BulletList',
      'OrderedList',
      'ATXHeading',
      'Blockquote',
      'HTMLBlock',
      'SetextHeading',
      'FencedCode',
      'HorizontalRule',
    ],
  },
])

const logTree = (node: any, source: string, level: number) => {
  const spaces = '  '.repeat(level)
  console.log(
    `${spaces}${node.type.name}: "${source.slice(node.from, node.to)}"`
  )
}

function visitTree(
  node: any,
  source: string,
  level = 0,
  visitFn: (node: any, source: string, level: number) => void
) {
  visitFn(node, source, level)

  // Recursively walk children
  let child = node.firstChild
  while (child) {
    visitTree(child, source, level + 1, visitFn)
    child = child.nextSibling
  }
}

class InternalLinkWidget extends WidgetType {
  constructor(readonly linkText: string) {
    super()
  }

  toDOM(view: EditorView) {
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

  toDOM(view: EditorView) {
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

  toDOM(view: EditorView) {
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
    const tree = parser.parse(src)

    // Log parsed tree
    // visitTree(tree.topNode, src, 0, logTree)

    // TODO: Quite a bit of redundant code here that could
    // be simplified

    visitTree(
      tree.topNode,
      src,
      0,
      (node: any, source: string, level: number) => {
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
              } catch (e) {}
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
      }
    )

    return builder.finish()
  }
}

export const syntaxPlugin = ViewPlugin.fromClass(SyntaxPlugin, {
  decorations: (value) => value.decorations,
})
