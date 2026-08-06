import { describe, expect, it } from 'vitest'
import { docMake, lineMake, type ZLine } from './schema'
import { diffDocs, proposalStats, proposalSummary } from './doc-diff'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const testLine = (
  mdContent: string,
  timeCreated: string,
  rest: Partial<ZLine> = {}
) => lineMake(0, mdContent, { timeCreated, ...rest })

describe('diffDocs', () => {
  it('returns nothing for identical docs', () => {
    const doc = docMake([testLine('A', iso(0)), testLine('B', iso(1))])
    expect(diffDocs(doc, doc)).toEqual([])
  })

  it('classifies content and indent changes as changed', () => {
    const base = docMake([testLine('A', iso(0)), testLine('B', iso(1))])
    const draft = docMake([
      testLine('A reworded', iso(0)),
      testLine('B', iso(1), { indent: 2 }),
    ])

    const changes = diffDocs(base, draft)
    expect(changes).toHaveLength(2)
    expect(changes[0]).toMatchObject({
      kind: 'changed',
      before: { mdContent: 'A' },
      after: { mdContent: 'A reworded' },
    })
    expect(changes[1]).toMatchObject({
      kind: 'changed',
      before: { indent: 0 },
      after: { indent: 2 },
    })
  })

  it('classifies new ids as inserted, in draft order', () => {
    const base = docMake([testLine('A', iso(0))])
    const draft = docMake([
      testLine('new top', iso(10)),
      testLine('A', iso(0)),
      testLine('new bottom', iso(11)),
    ])

    expect(diffDocs(base, draft)).toEqual([
      {
        kind: 'inserted',
        after: expect.objectContaining({ mdContent: 'new top' }),
      },
      {
        kind: 'inserted',
        after: expect.objectContaining({ mdContent: 'new bottom' }),
      },
    ])
  })

  it('interleaves deletions at their base position', () => {
    const base = docMake([
      testLine('A', iso(0)),
      testLine('gone-1', iso(1)),
      testLine('B', iso(2)),
      testLine('gone-2', iso(3)),
    ])
    const draft = docMake([
      testLine('A', iso(0)),
      testLine('B changed', iso(2)),
    ])

    expect(diffDocs(base, draft).map((c) => c.kind)).toEqual([
      'deleted',
      'changed',
      'deleted',
    ])
  })

  it('detects datum field changes', () => {
    const base = docMake([testLine('A', iso(0))])
    const draft = docMake([
      testLine('A', iso(0), { datumTaskStatus: 'complete' }),
    ])

    expect(diffDocs(base, draft)).toMatchObject([
      { kind: 'changed', after: { datumTaskStatus: 'complete' } },
    ])
  })

  it('handles a fully replaced doc', () => {
    const base = docMake([testLine('old', iso(0))])
    const draft = docMake([testLine('new', iso(1))])

    expect(diffDocs(base, draft).map((c) => c.kind)).toEqual([
      'inserted',
      'deleted',
    ])
  })
})

describe('proposalStats / proposalSummary', () => {
  it('counts by kind and formats a summary', () => {
    const base = docMake([
      testLine('A', iso(0)),
      testLine('B', iso(1)),
      testLine('C', iso(2)),
    ])
    const draft = docMake([
      testLine('A!', iso(0)),
      testLine('C', iso(2)),
      testLine('D', iso(3)),
    ])

    const changes = diffDocs(base, draft)
    expect(proposalStats(changes)).toEqual({
      changed: 1,
      inserted: 1,
      deleted: 1,
    })
    expect(proposalSummary(changes)).toBe('1 changed · 1 added · 1 deleted')
  })

  it('summarizes an empty change list', () => {
    expect(proposalSummary([])).toBe('No changes')
  })
})
