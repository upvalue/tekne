import { expect, test } from 'vitest'
import { applyDocumentEdit } from './document-edit'
import { docMake, lineMake } from './schema'

const now = '2026-11-08T12:00:00.000Z'

test('updates preserve metadata, null clears metadata, and IDs/timestamps are owned by the API', () => {
  const line = lineMake(0, 'Task #work', {
    collapsed: true,
    datumTaskStatus: 'unset',
    datumTimeSeconds: 60,
  })
  const source = docMake([line])
  const result = applyDocumentEdit(
    source,
    [
      {
        op: 'update',
        id: line.id,
        changes: { datumTaskStatus: 'complete', datumTimeSeconds: null },
      },
      {
        op: 'insert',
        after: line.id,
        lines: [{ mdContent: 'Child', indent: 1 }],
      },
    ],
    { now: () => now, id: () => 'l_abcdefghijklmnopqrstuA' }
  )
  expect(result.doc.children[0]).toEqual({
    ...line,
    datumTaskStatus: 'complete',
    datumTimeSeconds: undefined,
    timeUpdated: now,
  })
  expect(result.doc.children[1]).toMatchObject({
    id: 'l_abcdefghijklmnopqrstuA',
    timeCreated: now,
    timeUpdated: now,
  })
  expect(result.insertedLines).toEqual([
    { operationIndex: 1, lineIndex: 0, id: 'l_abcdefghijklmnopqrstuA' },
  ])
  expect(source.children).toEqual([line])
  expect(() =>
    applyDocumentEdit(source, [
      { op: 'update', id: line.id, changes: { id: line.id } } as never,
    ])
  ).toThrow()
})

test('subtree moves preserve relative indentation and individual deletion leaves children in place', () => {
  const lines = [
    lineMake(0, 'A'),
    lineMake(1, 'B'),
    lineMake(2, 'C'),
    lineMake(0, 'D'),
  ]
  const result = applyDocumentEdit(docMake(lines), [
    {
      op: 'move',
      id: lines[0].id,
      scope: 'subtree',
      after: lines[3].id,
      indent: 1,
    },
    { op: 'delete', id: lines[1].id, scope: 'line' },
  ])
  expect(result.doc.children.map((l) => [l.mdContent, l.indent])).toEqual([
    ['D', 0],
    ['A', 1],
    ['C', 3],
  ])
  const deleted = applyDocumentEdit(result.doc, [
    { op: 'delete', id: lines[0].id, scope: 'subtree' },
  ])
  expect(deleted.doc.children.map((l) => l.mdContent)).toEqual(['D'])
})

test('invalid anchors fail the entire batch without mutating the source', () => {
  const root = lineMake(0, 'Root'),
    child = lineMake(1, 'Child')
  const source = docMake([root, child])
  expect(() =>
    applyDocumentEdit(source, [
      { op: 'update', id: root.id, changes: { mdContent: 'Changed' } },
      { op: 'move', id: root.id, scope: 'subtree', after: child.id, indent: 0 },
    ])
  ).toThrow('Move anchor')
  expect(source.children).toEqual([root, child])
  expect(() =>
    applyDocumentEdit(source, [
      { op: 'delete', id: 'l_abcdefghijklmnopqrstuA', scope: 'line' },
    ])
  ).toThrow('Unknown line')
})
