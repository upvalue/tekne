import { describe, test, expect } from 'vitest'
import { docMake, lineMake, type ZLine } from '@/docs/schema'
import { generateCollapse } from '@/docs/collapse'
import { getLineId } from '../outline-selection'
import { stepVisibleLine } from './touch-nav'

const makeLines = (
  ...lines: [string, number, { collapsed?: boolean }?][]
): ZLine[] =>
  docMake(
    lines.map(([mdContent, indent, rest]) => ({
      ...lineMake(indent, mdContent),
      ...rest,
    }))
  ).children

const step = (lines: ZLine[], currentId: string | null, direction: 1 | -1) =>
  stepVisibleLine(lines, generateCollapse(lines), currentId, direction)

describe('stepVisibleLine', () => {
  test('walks the document in both directions', () => {
    const lines = makeLines(['a', 0], ['b', 0], ['c', 0])
    const [a, b, c] = lines.map(getLineId)
    expect(step(lines, null, 1)).toBe(a)
    expect(step(lines, a, 1)).toBe(b)
    expect(step(lines, b, 1)).toBe(c)
    expect(step(lines, c, 1)).toBe(c)
    expect(step(lines, null, -1)).toBe(c)
    expect(step(lines, b, -1)).toBe(a)
    expect(step(lines, a, -1)).toBe(a)
  })

  test('skips lines hidden inside a collapsed block', () => {
    const lines = makeLines(
      ['a', 0, { collapsed: true }],
      ['a1', 1],
      ['a2', 1],
      ['b', 0]
    )
    const [a, , , b] = lines.map(getLineId)
    expect(step(lines, a, 1)).toBe(b)
    expect(step(lines, b, -1)).toBe(a)
  })

  test('a stale id restarts from the edge, empty doc yields null', () => {
    const lines = makeLines(['a', 0])
    expect(step(lines, 'not-a-line', 1)).toBe(getLineId(lines[0]))
    expect(step([], null, 1)).toBeNull()
  })
})
