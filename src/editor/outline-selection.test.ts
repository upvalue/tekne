import { describe, expect, it } from 'vitest'
import { lineMake, type ZLine } from '@/docs/schema'
import {
  getSelectedRanges,
  getVisibleLineIds,
  selectOutlineBlock,
  selectOutlineRange,
  toggleOutlineBlockSelection,
} from './outline-selection'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const testLine = (mdContent: string, indent: number, index: number): ZLine =>
  lineMake(indent, mdContent, {
    timeCreated: iso(index),
    timeUpdated: iso(index),
  })

const lines = [
  testLine('A', 0, 0),
  testLine('B', 1, 1),
  testLine('C', 1, 2),
  testLine('D', 0, 3),
  testLine('E', 1, 4),
  testLine('F', 0, 5),
]

const contentsFor = (ids: string[]) =>
  ids.map((id) => lines.find((line) => line.timeCreated === id)?.mdContent)

describe('outline selection', () => {
  it('selects a parent line and its descendants', () => {
    expect(contentsFor(selectOutlineBlock(lines, 0))).toEqual(['A', 'B', 'C'])
  })

  it('selects only a child subtree when selecting a child line', () => {
    expect(contentsFor(selectOutlineBlock(lines, 1))).toEqual(['B'])
  })

  it('selects a subsection from an anchor block to a target block', () => {
    expect(contentsFor(selectOutlineRange(lines, iso(1), iso(3)))).toEqual([
      'B',
      'C',
      'D',
      'E',
    ])
  })

  it('toggles selected outline blocks on and off', () => {
    const withA = toggleOutlineBlockSelection(lines, [], 0)
    expect(contentsFor(withA)).toEqual(['A', 'B', 'C'])

    const withAAndD = toggleOutlineBlockSelection(lines, withA, 3)
    expect(contentsFor(withAAndD)).toEqual(['A', 'B', 'C', 'D', 'E'])

    const withoutA = toggleOutlineBlockSelection(lines, withAAndD, 0)
    expect(contentsFor(withoutA)).toEqual(['D', 'E'])
  })

  it('merges contiguous selected ids into ranges', () => {
    const selected = [iso(0), iso(1), iso(2), iso(4)]

    expect(getSelectedRanges(lines, selected)).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 5 },
    ])
  })

  it('keeps collapsed descendants selectable even when they are not visible ids', () => {
    expect(contentsFor(selectOutlineBlock(lines, 0))).toEqual(['A', 'B', 'C'])
    expect(
      getVisibleLineIds(lines, [
        'uncollapsed',
        'collapsed',
        'collapsed',
        'uncollapsed',
        'uncollapsed',
        'uncollapsed',
      ])
    ).toEqual([iso(0), iso(3), iso(4), iso(5)])
  })
})
