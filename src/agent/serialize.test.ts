import { describe, expect, it } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { serializeDocForPrompt } from './serialize'

describe('serializeDocForPrompt', () => {
  it('renders one id|indent|text row per line', () => {
    const doc = docMake([
      lineMake(0, 'first', { id: '2024-01-01T00:00:00.000Z' }),
      lineMake(2, 'child with #tag and [[Link]]', {
        id: '2024-01-01T00:00:00.001Z',
      }),
    ])

    expect(serializeDocForPrompt(doc)).toBe(
      '2024-01-01T00:00:00.000Z|0|first\n' +
        '2024-01-01T00:00:00.001Z|2|child with #tag and [[Link]]'
    )
  })
})
