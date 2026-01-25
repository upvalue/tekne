// parser.ts - Core markdown parsing functionality for Tekne
import {
  parser as baseParser,
  type MarkdownConfig,
  Strikethrough,
} from '@lezer/markdown'
import { tags as t } from '@lezer/highlight'
import { InternalLinkRegex, TagRegex } from './regex'
import type { SyntaxNode } from '@lezer/common'

const LBRACKET_CHAR_CODE = 91
const POUND_CHAR_CODE = 35

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
        if (next !== LBRACKET_CHAR_CODE) {
          return -1
        }

        // Short circuit if it's not two lbrackets
        if (cx.char(pos + 1) !== LBRACKET_CHAR_CODE) {
          return -1
        }

        const match: RegExpExecArray | null = InternalLinkRegex.exec(
          cx.slice(pos + 2, cx.end)
        )

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

export const TEKNE_MD_PARSER = baseParser.configure([
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

/**
 * Touch every node in a parsed markdown tree
 * @param node
 * @param source
 * @param level
 * @param visitFn
 */
export function visitMdTree(
  node: SyntaxNode,
  source: string,
  level = 0,
  visitFn: (node: any, source: string, level: number) => void
) {
  visitFn(node, source, level)

  // Recursively walk children
  let child = node.firstChild
  while (child) {
    visitMdTree(child, source, level + 1, visitFn)
    child = child.nextSibling
  }
}

/**
 * Parsed markdown node structure for database storage/querying.
 */
export type ParsedMdNode = {
  type: string
  from: number
  to: number
  text: string
  children: ParsedMdNode[]
}

/**
 * Converts syntax parser output into JSON structure
 * for database querying.
 */
export const jsonifyMdTree = (
  node: SyntaxNode,
  source: string,
  level = 0
): ParsedMdNode => {
  const nodeText = source.slice(node.from, node.to)
  const result: ParsedMdNode = {
    type: node.type.name,
    from: node.from,
    to: node.to,
    text: nodeText,
    children: [],
  }

  let child = node.firstChild
  while (child) {
    result.children.push(jsonifyMdTree(child, source, level + 1))
    child = child.nextSibling
  }

  return result
}