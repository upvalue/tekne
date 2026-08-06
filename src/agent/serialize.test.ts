import { describe, expect, it } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { serializeDocForPrompt } from './serialize'

describe('serializeDocForPrompt', () => {
  it('renders one id|indent|text row per line', () => {
    const doc = docMake([
      lineMake(0, 'first', { timeCreated: '2024-01-01T00:00:00.000Z' }),
      lineMake(2, 'child with #tag and [[Link]]', {
        timeCreated: '2024-01-01T00:00:00.001Z',
      }),
    ])

    expect(serializeDocForPrompt(doc)).toBe(
      '2024-01-01T00:00:00.000Z|0|first\n' +
        '2024-01-01T00:00:00.001Z|2|child with #tag and [[Link]]'
    )
  })

  it('renders an empty doc as an empty string', () => {
    expect(serializeDocForPrompt(docMake())).toBe('')
  })

  it('keeps pipes in content unambiguous (id and indent columns are fixed)', () => {
    const doc = docMake([
      lineMake(1, 'a | b', { timeCreated: '2024-01-01T00:00:00.000Z' }),
    ])
    const row = serializeDocForPrompt(doc)
    const [id, indent, ...restParts] = row.split('|')
    expect(id).toBe('2024-01-01T00:00:00.000Z')
    expect(indent).toBe('1')
    expect(restParts.join('|')).toBe('a | b')
  })
})
