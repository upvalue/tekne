import { expect, test, vi } from 'vitest'
import { lineIdMake, LINE_ID_PATTERN } from './line-identity'
import { docMake, lineMake, zdoc } from './schema'

test('IDs are compact and independent of creation timestamps', () => {
  vi.useFakeTimers()
  try {
    const lines = Array.from({ length: 1000 }, () => lineMake(0))
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length)
    expect(new Set(lines.map((line) => line.timeCreated)).size).toBe(1)
    expect(
      lines.every(
        (line) => LINE_ID_PATTERN.test(line.id) && line.id.length === 24
      )
    ).toBe(true)
  } finally {
    vi.useRealTimers()
  }
})

test('document validation rejects missing, malformed, and duplicate IDs', () => {
  const line = lineMake(0)
  expect(zdoc.safeParse(docMake([line, { ...line }])).success).toBe(false)
  expect(zdoc.safeParse(docMake([{ ...line, id: 'bad' }])).success).toBe(false)
  expect(
    zdoc.safeParse({
      ...docMake([line]),
      children: [{ ...line, id: undefined }],
    }).success
  ).toBe(false)
  expect(
    zdoc.safeParse(docMake([line, { ...line, id: lineIdMake() }])).success
  ).toBe(true)
})

test('copies get new IDs, while edits and undo snapshots can retain the originals', async () => {
  const { copyLines } = await import('./schema')
  const original = [lineMake(0, 'parent'), lineMake(1, 'child')]
  const copied = copyLines(original)
  expect(
    copied
      .map((line) => line.id)
      .some((id) => original.some((line) => line.id === id))
  ).toBe(false)
  expect(copied.map((line) => line.mdContent)).toEqual(['parent', 'child'])
  expect(copied.map((line) => line.indent)).toEqual([0, 1])
  expect(zdoc.safeParse(docMake([...original, ...copied])).success).toBe(true)
})
