import { describe, expect, it } from 'vitest'
import { docMake, lineMake, type ZLine } from '@/docs/schema'
import { applyEditOps, summarizeOpResults, type EditOp } from './edit-ops'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const testLine = (
  mdContent: string,
  timeCreated: string,
  rest: Partial<ZLine> = {}
) => lineMake(0, mdContent, { timeCreated, timeUpdated: timeCreated, ...rest })

const baseDoc = () =>
  docMake([
    testLine('alpha', iso(0)),
    testLine('beta', iso(1), { indent: 1 }),
    testLine('gamma', iso(2)),
  ])

describe('applyEditOps', () => {
  it('replaces content and bumps timeUpdated', () => {
    const doc = baseDoc()
    const { doc: next, results } = applyEditOps(doc, [
      { op: 'replace', id: iso(1), mdContent: 'beta reworded' },
    ])

    expect(results).toEqual([{ ok: true }])
    expect(next.children[1].mdContent).toBe('beta reworded')
    expect(next.children[1].indent).toBe(1)
    expect(next.children[1].timeCreated).toBe(iso(1))
    expect(next.children[1].timeUpdated).not.toBe(iso(1))
  })

  it('sets indent', () => {
    const { doc: next } = applyEditOps(baseDoc(), [
      { op: 'set_indent', id: iso(2), indent: 3 },
    ])
    expect(next.children[2].indent).toBe(3)
  })

  it('deletes lines', () => {
    const { doc: next } = applyEditOps(baseDoc(), [
      { op: 'delete', id: iso(1) },
    ])
    expect(next.children.map((l) => l.mdContent)).toEqual(['alpha', 'gamma'])
  })

  it('inserts at the top with id null', () => {
    const { doc: next } = applyEditOps(baseDoc(), [
      {
        op: 'insert_after',
        id: null,
        lines: [{ mdContent: 'new first', indent: 0 }],
      },
    ])
    expect(next.children[0].mdContent).toBe('new first')
    expect(next.children).toHaveLength(4)
  })

  it('inserts multiple lines after a given id, in order', () => {
    const { doc: next } = applyEditOps(baseDoc(), [
      {
        op: 'insert_after',
        id: iso(0),
        lines: [
          { mdContent: 'child one', indent: 1 },
          { mdContent: 'child two', indent: 1 },
        ],
      },
    ])
    expect(next.children.map((l) => l.mdContent)).toEqual([
      'alpha',
      'child one',
      'child two',
      'beta',
      'gamma',
    ])
  })

  it('gives inserted lines fresh unique ids via lineMake', () => {
    const { doc: next } = applyEditOps(baseDoc(), [
      {
        op: 'insert_after',
        id: iso(2),
        lines: [
          { mdContent: 'x', indent: 0 },
          { mdContent: 'y', indent: 0 },
        ],
      },
    ])
    const ids = next.children.map((l) => l.timeCreated)
    expect(new Set(ids).size).toBe(ids.length)
    expect(next.children[3].type).toBe('line')
  })

  it('continues past unknown ids with per-op errors', () => {
    const { doc: next, results } = applyEditOps(baseDoc(), [
      { op: 'replace', id: 'bogus', mdContent: 'nope' },
      { op: 'replace', id: iso(0), mdContent: 'alpha!' },
      {
        op: 'insert_after',
        id: 'also-bogus',
        lines: [{ mdContent: 'z', indent: 0 }],
      },
    ])

    expect(results).toEqual([
      { ok: false, error: 'no line with id bogus' },
      { ok: true },
      { ok: false, error: 'no line with id also-bogus' },
    ])
    expect(next.children[0].mdContent).toBe('alpha!')
    expect(next.children).toHaveLength(3)
  })

  it('applies sequentially: later ops see earlier results', () => {
    // Insert a line, then replace the *inserted* line via a follow-up delete
    // of an original neighbor -- position arithmetic must track the mutation.
    const ops: EditOp[] = [
      { op: 'delete', id: iso(0) },
      {
        op: 'insert_after',
        id: iso(1),
        lines: [{ mdContent: 'after beta', indent: 1 }],
      },
    ]
    const { doc: next, results } = applyEditOps(baseDoc(), ops)
    expect(results.every((r) => r.ok)).toBe(true)
    expect(next.children.map((l) => l.mdContent)).toEqual([
      'beta',
      'after beta',
      'gamma',
    ])
  })

  it('does not mutate the input doc', () => {
    const doc = baseDoc()
    const snapshot = JSON.parse(JSON.stringify(doc))
    applyEditOps(doc, [
      { op: 'replace', id: iso(0), mdContent: 'changed' },
      { op: 'delete', id: iso(1) },
      { op: 'insert_after', id: null, lines: [{ mdContent: 'q', indent: 0 }] },
    ])
    expect(doc).toEqual(snapshot)
  })
})

describe('summarizeOpResults', () => {
  it('reports full success compactly', () => {
    expect(summarizeOpResults([{ ok: true }, { ok: true }])).toBe(
      'Applied 2 operations.'
    )
  })

  it('lists failures with their op numbers', () => {
    expect(
      summarizeOpResults([
        { ok: true },
        { ok: false, error: 'no line with id x' },
      ])
    ).toBe('Applied 1 of 2 operations.\nop 2 failed: no line with id x')
  })
})
