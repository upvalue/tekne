import { describe, it, expect } from 'vitest'
import {
  generateGutterTimestamps,
  TIME_DIFF_THRESHOLD_MINUTES,
} from './gutters'
import { lineMake } from './schema'
import type { ZLine } from './schema'

describe('generateGutterTimestamps', () => {
  it('shows timestamp for first line', () => {
    const lines: ZLine[] = [
      {
        ...lineMake(0),
        timeUpdated: '2024-08-18T17:30:00.000Z',
      },
    ]

    const result = generateGutterTimestamps(lines)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/8\/18 \d{1,2}:\d{2} (AM|PM)/)
  })

  it('returns null for subsequent lines within time threshold', () => {
    const baseTime = new Date('2024-08-18T17:30:00.000Z')
    const lines: ZLine[] = [
      {
        ...lineMake(0),
        timeUpdated: baseTime.toISOString(),
      },
      {
        ...lineMake(0),
        timeUpdated: new Date(
          baseTime.getTime() + 10 * 60 * 1000
        ).toISOString(), // 10 minutes later
      },
    ]

    const result = generateGutterTimestamps(lines)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatch(/8\/18 \d{1,2}:\d{2} (AM|PM)/)
    expect(result[1]).toBeNull()
  })

  it('shows time when difference exceeds threshold', () => {
    const baseTime = new Date('2024-08-18T17:30:00.000Z')
    const lines: ZLine[] = [
      {
        ...lineMake(0),
        timeUpdated: baseTime.toISOString(),
      },
      {
        ...lineMake(0),
        timeUpdated: new Date(
          baseTime.getTime() + (TIME_DIFF_THRESHOLD_MINUTES + 5) * 60 * 1000
        ).toISOString(),
      },
    ]

    const result = generateGutterTimestamps(lines)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatch(/8\/18 \d{1,2}:\d{2} (AM|PM)/)
    expect(result[1]).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/) // Only time, no date
  })

  it('shows full date when date differs', () => {
    const lines: ZLine[] = [
      {
        ...lineMake(0),
        timeUpdated: '2024-08-18T17:30:00.000Z',
      },
      {
        ...lineMake(0),
        timeUpdated: '2024-08-19T09:15:00.000Z', // Next day
      },
    ]

    const result = generateGutterTimestamps(lines)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatch(/8\/18 \d{1,2}:\d{2} (AM|PM)/)
    expect(result[1]).toMatch(/8\/19 \d{1,2}:\d{2} (AM|PM)/)
  })

  it('handles multiple lines with mixed scenarios', () => {
    const baseTime = new Date('2024-08-18T17:30:00.000Z')
    const lines: ZLine[] = [
      {
        ...lineMake(0),
        timeUpdated: baseTime.toISOString(),
      },
      {
        ...lineMake(0),
        timeUpdated: new Date(baseTime.getTime() + 5 * 60 * 1000).toISOString(), // 5 minutes later - should be null
      },
      {
        ...lineMake(0),
        timeUpdated: new Date(
          baseTime.getTime() + 25 * 60 * 1000
        ).toISOString(), // 25 minutes later - should show time
      },
      {
        ...lineMake(0),
        timeUpdated: '2024-08-19T10:00:00.000Z', // Next day - should show full date
      },
    ]

    const result = generateGutterTimestamps(lines)

    expect(result).toHaveLength(4)
    expect(result[0]).toMatch(/8\/18 \d{1,2}:\d{2} (AM|PM)/) // First line - full date
    expect(result[1]).toBeNull() // Within threshold
    expect(result[2]).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/) // Time only
    expect(result[3]).toMatch(/8\/19 \d{1,2}:\d{2} (AM|PM)/) // New date - full date
  })

  it('handles empty array', () => {
    const result = generateGutterTimestamps([])
    expect(result).toEqual([])
  })

  it('handles exact threshold boundary', () => {
    const baseTime = new Date('2024-08-18T17:30:00.000Z')
    const lines: ZLine[] = [
      {
        ...lineMake(0),
        timeUpdated: baseTime.toISOString(),
      },
      {
        ...lineMake(0),
        timeUpdated: new Date(
          baseTime.getTime() + TIME_DIFF_THRESHOLD_MINUTES * 60 * 1000
        ).toISOString(), // Exactly threshold
      },
    ]

    const result = generateGutterTimestamps(lines)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatch(/8\/18 \d{1,2}:\d{2} (AM|PM)/)
    expect(result[1]).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/) // Should show time at exact threshold
  })
})
