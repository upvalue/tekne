import { describe, test, expect } from 'vitest'
import { jsonifyMdTree, TEKNE_MD_PARSER } from './parser'

function serializeTree(node: any, source: string, depth = 0): string {
  const indent = '  '.repeat(depth)
  const nodeText = source.slice(node.from, node.to)
  let result = `${indent}${node.type.name}(${node.from}-${node.to}): "${nodeText}"`

  let child = node.firstChild
  while (child) {
    result += '\n' + serializeTree(child, source, depth + 1)
    child = child.nextSibling
  }

  return result
}

describe('jsonifyTree', () => {
  test('should jsonify tree', () => {
    const text = 'hello [[MyPage]]'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = jsonifyMdTree(tree.topNode, text)
    expect(serialized).toMatchSnapshot()
  })
})

describe('TEKNE_MD_PARSER', () => {
  test.each([
    '2026-10-12',
    'foo-bar',
    'Project: Alpha',
    '$Daily',
    'folder/My notes',
  ])('preserves the complete link target and spans: %s', (title) => {
    const text = `before [[${title}]] after [[Other]]`
    const links: Array<{ from: number; to: number; text: string }> = []
    TEKNE_MD_PARSER.parse(text).iterate({
      enter(node) {
        if (node.name === 'InternalLinkBody') {
          links.push({
            from: node.from,
            to: node.to,
            text: text.slice(node.from, node.to),
          })
        }
      },
    })
    expect(links).toEqual([
      { from: 9, to: 9 + title.length, text: title },
      {
        from: text.indexOf('Other'),
        to: text.indexOf('Other') + 5,
        text: 'Other',
      },
    ])
  })

  test.each(['[[#Invalid]]', '[[]]', '[[broken\nlink]]'])(
    'rejects malformed links without matching a suffix: %s',
    (text) => {
      const links: string[] = []
      TEKNE_MD_PARSER.parse(text).iterate({
        enter(node) {
          if (node.name === 'InternalLinkBody')
            links.push(text.slice(node.from, node.to))
        },
      })
      expect(links).toEqual([])
    }
  )

  test('parses basic text "hello"', () => {
    const text = 'hello'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = serializeTree(tree.topNode, text)

    expect(serialized).toMatchSnapshot()
  })

  test('does not parse invalid internal link as internal link', () => {
    const text = 'hello [[]]'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = serializeTree(tree.topNode, text)

    expect(serialized).toMatchSnapshot()
  })

  test('parses internal link 1', () => {
    const text = 'hello [[MyPage]]'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = serializeTree(tree.topNode, text)

    expect(serialized).toMatchSnapshot()
  })

  test('parses internal link 2', () => {
    const text = 'hello [[MyPage2]]'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = serializeTree(tree.topNode, text)

    expect(serialized).toMatchSnapshot()
  })

  test('parses text with emphasis', () => {
    const text = 'hello *world*'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = serializeTree(tree.topNode, text)

    expect(serialized).toMatchSnapshot()
  })

  test('parses tag', () => {
    const text = 'hello #mytag'
    const tree = TEKNE_MD_PARSER.parse(text)
    const serialized = serializeTree(tree.topNode, text)

    expect(serialized).toMatchSnapshot()
  })
})
