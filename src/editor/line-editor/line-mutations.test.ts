import { describe, test, expect } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import {
  canIndentLine,
  dropFirstLine,
  indentLine,
  mergeIntoPreviousLine,
  outdentLine,
  removeLine,
  splitLine,
} from './line-mutations'

const doc = (...lines: Array<[indent: number, content: string]>) =>
  docMake(lines.map(([indent, content]) => lineMake(indent, content)))

const shape = (d: ReturnType<typeof doc>) =>
  d.children.map((l) => [l.indent, l.mdContent])

describe('indent', () => {
  test('a line can indent at most one level past its predecessor', () => {
    const d = doc([0, 'first'], [0, 'second'], [1, 'child'])
    expect(canIndentLine(d, 0)).toBe(false) // first line never indents
    expect(canIndentLine(d, 1)).toBe(true)
    expect(canIndentLine(d, 2)).toBe(false) // already one past its predecessor
  })

  test('indentLine bumps indent and timeUpdated', () => {
    const d = doc([0, 'a'], [0, 'b'])
    const next = indentLine(d, 1)
    expect(shape(next)).toEqual([
      [0, 'a'],
      [1, 'b'],
    ])
    expect(next.children[1].timeUpdated).not.toBe(d.children[1].timeUpdated)
  })

  test('outdentLine returns null at the left margin', () => {
    const d = doc([0, 'a'], [1, 'b'])
    expect(outdentLine(d, 0)).toBeNull()
    expect(shape(outdentLine(d, 1)!)).toEqual([
      [0, 'a'],
      [0, 'b'],
    ])
  })
})

describe('splitLine', () => {
  test('inserts the remainder after the line at the same indent', () => {
    const d = doc([1, 'hello world'])
    const next = splitLine(d, 0, 'world')
    expect(shape(next)).toEqual([
      [1, 'hello world'],
      [1, 'world'],
    ])
  })

  test('splitting a collapsed line uncollapses it', () => {
    const d = docMake([
      lineMake(0, 'parent', { collapsed: true }),
      lineMake(1, 'child'),
    ])
    const next = splitLine(d, 0, '')
    expect(next.children[0].collapsed).toBeUndefined()
    expect(next.children).toHaveLength(3)
  })

  test('the new line gets a fresh identity', () => {
    const d = doc([0, 'a'])
    const next = splitLine(d, 0, '')
    expect(next.children[1].timeCreated).not.toBe(d.children[0].timeCreated)
  })
})

describe('mergeIntoPreviousLine', () => {
  test('splices content onto the previous line and focuses the join point', () => {
    const d = doc([0, 'first'], [0, 'second'], [0, 'third'])
    const { doc: next, focus } = mergeIntoPreviousLine(d, 1, 'second')
    expect(shape(next)).toEqual([
      [0, 'firstsecond'],
      [0, 'third'],
    ])
    expect(focus).toEqual({ lineIdx: 0, pos: 'first'.length })
  })

  test('merges live editor content, not the stale stored line', () => {
    // The CodeMirror buffer is the source of truth for the merged line
    const d = doc([0, 'first'], [0, 'stale'])
    const { doc: next } = mergeIntoPreviousLine(d, 1, 'fresh')
    expect(next.children[0].mdContent).toBe('firstfresh')
  })
})

describe('dropFirstLine', () => {
  test('drops the first line unless it is the only one', () => {
    expect(dropFirstLine(doc([0, 'only']))).toBeNull()
    expect(shape(dropFirstLine(doc([0, 'a'], [1, 'b']))!)).toEqual([[1, 'b']])
  })
})

describe('removeLine', () => {
  test('clears the last remaining line instead of removing it', () => {
    const { doc: next, focus } = removeLine(doc([0, 'only line']), 0)
    expect(shape(next)).toEqual([[0, '']])
    expect(focus).toBeNull()
  })

  test('removes a middle line and focuses the end of the previous one', () => {
    const d = doc([0, 'aaa'], [0, 'bbb'], [0, 'ccc'])
    const { doc: next, focus } = removeLine(d, 1)
    expect(shape(next)).toEqual([
      [0, 'aaa'],
      [0, 'ccc'],
    ])
    expect(focus).toEqual({ lineIdx: 0, pos: 3 })
  })
})
