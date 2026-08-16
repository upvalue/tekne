import { describe, expect, test } from 'vitest'
import { localDateCutoff } from './date-cutoff'

describe('localDateCutoff', () => {
  test('uses the start of the selected day in the browser timezone', () => {
    expect(localDateCutoff('2025-02-03')).toBe(
      new Date(2025, 1, 3).toISOString()
    )
  })

  test('rejects incomplete date values', () => {
    expect(localDateCutoff('')).toBeNull()
    expect(localDateCutoff('2025-02')).toBeNull()
  })
})
