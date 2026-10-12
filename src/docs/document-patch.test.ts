import { expect, test } from 'vitest'
import { applyDocumentPatch, diffDocuments } from './document-patch'
import { docMake, lineMake } from './schema'

test('patches text, metadata, insertions, deletions and moves without mutating the source', () => {
  const before = docMake([
    lineMake(0, 'parent #work'),
    lineMake(1, 'child'),
    lineMake(0, 'delete me'),
  ])
  const original = structuredClone(before)
  const after = docMake([
    { ...before.children[1], indent: 0, datumTaskStatus: 'complete' },
    lineMake(1, 'inserted'),
    { ...before.children[0], mdContent: 'renamed #tag', collapsed: true },
  ])
  expect(applyDocumentPatch(before, diffDocuments(before, after))).toEqual(
    after
  )
  expect(before).toEqual(original)
  expect(diffDocuments(before, before)).toEqual([])
  expect(
    applyDocumentPatch(before, diffDocuments(before, docMake([])))
  ).toEqual(docMake([]))
})

test('a single changed line produces a small patch regardless of document size', () => {
  const before = docMake(
    Array.from({ length: 2000 }, (_, i) => lineMake(0, `line ${i}`))
  )
  const after = structuredClone(before)
  after.children[1000].mdContent += '!'
  const patch = diffDocuments(before, after)
  expect(patch).toEqual([{ op: 'update', line: after.children[1000] }])
  expect(JSON.stringify(patch).length).toBeLessThan(
    JSON.stringify(after).length / 100
  )
})

test('seeded edit sequences round-trip', () => {
  let seed = 41
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % max
  }
  let before = docMake(
    Array.from({ length: 25 }, (_, i) => lineMake(0, `${i}`))
  )
  for (let iteration = 0; iteration < 300; iteration++) {
    const after = structuredClone(before)
    for (let edit = 0; edit < 8; edit++) {
      const index = random(after.children.length || 1)
      const op = random(4)
      if (op === 0 || after.children.length === 0)
        after.children.splice(index, 0, lineMake(random(3), 'new'))
      else if (op === 1) after.children.splice(index, 1)
      else if (op === 2) after.children[index].mdContent += '#tag'
      else
        after.children.splice(
          random(after.children.length),
          0,
          ...after.children.splice(index, 1)
        )
    }
    expect(applyDocumentPatch(before, diffDocuments(before, after))).toEqual(
      after
    )
    before = after
  }
})

test('rejects duplicate IDs, unknown targets and self anchors', () => {
  const line = lineMake(0, 'line')
  const doc = docMake([line])
  expect(() =>
    applyDocumentPatch(doc, [{ op: 'insert', line, after: null }])
  ).toThrow('Duplicate')
  expect(() =>
    applyDocumentPatch(doc, [{ op: 'delete', id: lineMake(0).id }])
  ).toThrow('Unknown')
  expect(() =>
    applyDocumentPatch(doc, [{ op: 'move', id: line.id, after: line.id }])
  ).toThrow('itself')
})
