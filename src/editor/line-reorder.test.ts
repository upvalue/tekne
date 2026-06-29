import { describe, expect, it } from 'vitest'
import { lineMake, type ZLine } from '@/docs/schema'
import { moveSelectedLines } from './line-reorder'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`
const movedAt = '2024-02-01T00:00:00.000Z'

const testLine = (mdContent: string, indent: number, index: number): ZLine =>
  lineMake(indent, mdContent, {
    timeCreated: iso(index),
    timeUpdated: iso(index),
  })

const contents = (lines: ZLine[]) => lines.map((line) => line.mdContent)

describe('moveSelectedLines', () => {
  it('moves a single leaf before another line', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 0, 1),
      testLine('C', 0, 2),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(2)],
      targetId: iso(0),
      edge: 'before',
      touchedLineId: iso(2),
      now: movedAt,
    })

    expect(result.moved).toBe(true)
    expect(contents(result.lines)).toEqual(['C', 'A', 'B'])
  })

  it('moves a parent subtree with its descendants', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 1, 1),
      testLine('C', 1, 2),
      testLine('D', 0, 3),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(0), iso(1), iso(2)],
      targetId: iso(3),
      edge: 'after',
      touchedLineId: iso(0),
      now: movedAt,
    })

    expect(contents(result.lines)).toEqual(['D', 'A', 'B', 'C'])
  })

  it('moves multiple selected ranges while preserving their relative order', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 0, 1),
      testLine('C', 0, 2),
      testLine('D', 0, 3),
      testLine('E', 0, 4),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(0), iso(2)],
      targetId: iso(4),
      edge: 'after',
      touchedLineId: iso(2),
      now: movedAt,
    })

    expect(contents(result.lines)).toEqual(['B', 'D', 'E', 'A', 'C'])
  })

  it('can move multiple selected ranges into a gap before a later selected range', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 0, 1),
      testLine('C', 0, 2),
      testLine('D', 0, 3),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(0), iso(2)],
      targetId: iso(1),
      edge: 'after',
      touchedLineId: iso(0),
      now: movedAt,
    })

    expect(contents(result.lines)).toEqual(['B', 'A', 'C', 'D'])
  })

  it('does nothing when dropping into the selected range', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 1, 1),
      testLine('C', 1, 2),
      testLine('D', 0, 3),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(0), iso(1), iso(2)],
      targetId: iso(1),
      edge: 'before',
      touchedLineId: iso(0),
      now: movedAt,
    })

    expect(result).toEqual({ lines, moved: false })
  })

  it('drops after a parent after the target parent subtree', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 0, 1),
      testLine('C', 1, 2),
      testLine('D', 0, 3),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(0)],
      targetId: iso(1),
      edge: 'after',
      touchedLineId: iso(0),
      now: movedAt,
    })

    expect(contents(result.lines)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('updates only the touched line timeUpdated and never changes timeCreated', () => {
    const lines = [
      testLine('A', 0, 0),
      testLine('B', 0, 1),
      testLine('C', 0, 2),
    ]

    const result = moveSelectedLines({
      lines,
      selectedLineIds: [iso(0), iso(1)],
      targetId: iso(2),
      edge: 'after',
      touchedLineId: iso(1),
      now: movedAt,
    })

    expect(result.lines.map((line) => line.timeCreated)).toEqual([
      iso(2),
      iso(0),
      iso(1),
    ])
    expect(result.lines.map((line) => line.timeUpdated)).toEqual([
      iso(2),
      iso(0),
      movedAt,
    ])
  })
})
