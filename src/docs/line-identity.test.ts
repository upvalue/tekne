import { describe, expect, it } from 'vitest'
import { docMake, lineMake, type ZLine } from './schema'
import { ensureUniqueLineTimeCreateds } from './line-identity'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const testLine = (
  mdContent: string,
  timeCreated: string,
  rest: Partial<ZLine> = {}
) =>
  lineMake(0, mdContent, {
    timeCreated,
    timeUpdated: '2024-01-02T00:00:00.000Z',
    ...rest,
  })

describe('ensureUniqueLineTimeCreateds', () => {
  it('returns the original doc when timestamps are already unique', () => {
    const doc = docMake([testLine('A', iso(0)), testLine('B', iso(1))])

    expect(ensureUniqueLineTimeCreateds(doc)).toBe(doc)
  })

  it('repairs later duplicate timestamps while preserving the first occurrence', () => {
    const doc = docMake([
      testLine('A', iso(0)),
      testLine('B', iso(0)),
      testLine('C', iso(0)),
    ])

    const result = ensureUniqueLineTimeCreateds(doc)

    expect(result.children.map((line) => line.timeCreated)).toEqual([
      iso(0),
      iso(1),
      iso(2),
    ])
  })

  it('skips over collision chains when repairing duplicates', () => {
    const doc = docMake([
      testLine('A', iso(0)),
      testLine('B', iso(1)),
      testLine('C', iso(0)),
    ])

    const result = ensureUniqueLineTimeCreateds(doc)

    expect(result.children.map((line) => line.timeCreated)).toEqual([
      iso(0),
      iso(1),
      iso(2),
    ])
  })

  it('preserves order and timeUpdated', () => {
    const doc = docMake([
      testLine('A', iso(0), { timeUpdated: '2024-02-01T00:00:00.000Z' }),
      testLine('B', iso(0), { timeUpdated: '2024-03-01T00:00:00.000Z' }),
    ])

    const result = ensureUniqueLineTimeCreateds(doc)

    expect(result.children.map((line) => line.mdContent)).toEqual(['A', 'B'])
    expect(result.children.map((line) => line.timeUpdated)).toEqual([
      '2024-02-01T00:00:00.000Z',
      '2024-03-01T00:00:00.000Z',
    ])
  })
})
