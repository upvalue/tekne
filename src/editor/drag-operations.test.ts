import { describe, it, expect } from 'vitest'
import { computeLineMove, expandCollapsedChildren, rebaseIndent } from './drag-operations'
import { lineMake } from '@/docs/schema'
import type { CollapseState } from '@/docs/collapse'

const makeLines = (contents: string[]) =>
  contents.map((c, i) => lineMake(0, c, { timeCreated: `2024-01-01T00:00:0${i}.000Z` }))

describe('computeLineMove', () => {
  it('moves a single line down', () => {
    const lines = makeLines(['A', 'B', 'C', 'D'])
    const result = computeLineMove(lines, [0], 3)
    expect(result!.map((l) => l.mdContent)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('moves a single line up', () => {
    const lines = makeLines(['A', 'B', 'C', 'D'])
    const result = computeLineMove(lines, [3], 1)
    expect(result!.map((l) => l.mdContent)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('moves a single line to the end', () => {
    const lines = makeLines(['A', 'B', 'C'])
    const result = computeLineMove(lines, [0], 3)
    expect(result!.map((l) => l.mdContent)).toEqual(['B', 'C', 'A'])
  })

  it('moves a single line to the start', () => {
    const lines = makeLines(['A', 'B', 'C'])
    const result = computeLineMove(lines, [2], 0)
    expect(result!.map((l) => l.mdContent)).toEqual(['C', 'A', 'B'])
  })

  it('returns null for no-op (drop on self)', () => {
    const lines = makeLines(['A', 'B', 'C'])
    expect(computeLineMove(lines, [1], 1)).toBeNull()
    expect(computeLineMove(lines, [1], 2)).toBeNull()
  })

  it('returns null for empty draggedIndices', () => {
    const lines = makeLines(['A', 'B', 'C'])
    expect(computeLineMove(lines, [], 1)).toBeNull()
  })

  it('moves multiple contiguous lines down', () => {
    const lines = makeLines(['A', 'B', 'C', 'D', 'E'])
    const result = computeLineMove(lines, [1, 2], 4)
    expect(result!.map((l) => l.mdContent)).toEqual(['A', 'D', 'B', 'C', 'E'])
  })

  it('moves multiple contiguous lines up', () => {
    const lines = makeLines(['A', 'B', 'C', 'D', 'E'])
    const result = computeLineMove(lines, [3, 4], 1)
    expect(result!.map((l) => l.mdContent)).toEqual(['A', 'D', 'E', 'B', 'C'])
  })

  it('moves non-contiguous lines', () => {
    const lines = makeLines(['A', 'B', 'C', 'D', 'E'])
    const result = computeLineMove(lines, [0, 3], 2)
    expect(result!.map((l) => l.mdContent)).toEqual(['B', 'A', 'D', 'C', 'E'])
  })

  it('returns null for contiguous block no-op at end boundary', () => {
    const lines = makeLines(['A', 'B', 'C'])
    expect(computeLineMove(lines, [1, 2], 3)).toBeNull()
  })
})

describe('expandCollapsedChildren', () => {
  it('returns same indices when no collapse-start selected', () => {
    const lines = [
      lineMake(0, 'A'),
      lineMake(0, 'B'),
      lineMake(0, 'C'),
    ]
    const states: CollapseState[] = ['uncollapsed', 'uncollapsed', 'uncollapsed']
    expect(expandCollapsedChildren(lines, [1], states)).toEqual([1])
  })

  it('expands collapsed children of a selected parent', () => {
    const lines = [
      lineMake(0, 'Parent'),
      lineMake(1, 'Child 1'),
      lineMake(1, 'Child 2'),
      lineMake(0, 'Sibling'),
    ]
    const states: CollapseState[] = ['collapse-start', 'collapsed', 'collapsed', 'uncollapsed']
    expect(expandCollapsedChildren(lines, [0], states)).toEqual([0, 1, 2])
  })

  it('expands nested collapsed children', () => {
    const lines = [
      lineMake(0, 'Parent'),
      lineMake(1, 'Child'),
      lineMake(2, 'Grandchild'),
      lineMake(0, 'Sibling'),
    ]
    const states: CollapseState[] = ['collapse-start', 'collapsed', 'collapsed', 'uncollapsed']
    expect(expandCollapsedChildren(lines, [0], states)).toEqual([0, 1, 2])
  })

  it('does not duplicate already-selected children', () => {
    const lines = [
      lineMake(0, 'Parent'),
      lineMake(1, 'Child'),
      lineMake(0, 'Sibling'),
    ]
    const states: CollapseState[] = ['collapse-start', 'collapsed', 'uncollapsed']
    expect(expandCollapsedChildren(lines, [0, 1], states)).toEqual([0, 1])
  })

  it('handles collapsed parent at end of document', () => {
    const lines = [
      lineMake(0, 'A'),
      lineMake(0, 'Parent'),
      lineMake(1, 'Child'),
    ]
    const states: CollapseState[] = ['uncollapsed', 'collapse-start', 'collapsed']
    expect(expandCollapsedChildren(lines, [1], states)).toEqual([1, 2])
  })
})

describe('rebaseIndent', () => {
  const makeLinesWithIndent = (specs: [string, number][]) =>
    specs.map(([c, indent], i) =>
      lineMake(indent, c, { timeCreated: `2024-01-01T00:00:0${i}.000Z` })
    )

  it('rebases deeply indented lines to match neighbor above', () => {
    // Simulates dragging lines at indent [3,4,4] to sit after a line at indent 1
    const lines = makeLinesWithIndent([
      ['Above', 1],
      ['Dragged1', 3],
      ['Dragged2', 4],
      ['Dragged3', 4],
      ['Below', 0],
    ])
    const dragged = new Set([lines[1].timeCreated, lines[2].timeCreated, lines[3].timeCreated])
    const result = rebaseIndent(lines, dragged)
    expect(result.map((l) => l.indent)).toEqual([1, 1, 2, 2, 0])
  })

  it('does nothing when indent already matches', () => {
    const lines = makeLinesWithIndent([
      ['Above', 2],
      ['Dragged', 2],
      ['Below', 0],
    ])
    const dragged = new Set([lines[1].timeCreated])
    const result = rebaseIndent(lines, dragged)
    expect(result.map((l) => l.indent)).toEqual([2, 2, 0])
  })

  it('clamps indent to 0 when rebasing would go negative', () => {
    // Dragging indent [2, 3] to position 0 (no line above)
    const lines = makeLinesWithIndent([
      ['Dragged1', 2],
      ['Dragged2', 3],
      ['Below', 0],
    ])
    const dragged = new Set([lines[0].timeCreated, lines[1].timeCreated])
    const result = rebaseIndent(lines, dragged)
    expect(result.map((l) => l.indent)).toEqual([0, 1, 0])
  })

  it('increases indent when moving to a more indented area', () => {
    const lines = makeLinesWithIndent([
      ['Above', 3],
      ['Dragged1', 0],
      ['Dragged2', 1],
      ['Below', 0],
    ])
    const dragged = new Set([lines[1].timeCreated, lines[2].timeCreated])
    const result = rebaseIndent(lines, dragged)
    expect(result.map((l) => l.indent)).toEqual([3, 3, 4, 0])
  })

  it('does not modify non-dragged lines', () => {
    const lines = makeLinesWithIndent([
      ['Above', 0],
      ['Dragged', 3],
      ['Below', 5],
    ])
    const dragged = new Set([lines[1].timeCreated])
    const result = rebaseIndent(lines, dragged)
    expect(result[0].indent).toBe(0)
    expect(result[2].indent).toBe(5)
  })
})
