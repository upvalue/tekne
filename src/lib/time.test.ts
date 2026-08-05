import { describe, test, expect } from 'vitest'
import { formatTimeDisplay, renderTime } from './time'

// Two formatters, two deliberate styles: formatTimeDisplay is a running
// clock (m:ss / h:mm:ss), renderTime is a compact summary ("1h 5m") that
// drops seconds once any larger unit exists.

describe('formatTimeDisplay (clock style)', () => {
  test('zero and sub-minute values', () => {
    expect(formatTimeDisplay(0)).toBe('0:00')
    expect(formatTimeDisplay(5)).toBe('0:05')
    expect(formatTimeDisplay(59)).toBe('0:59')
  })

  test('minutes and hours', () => {
    expect(formatTimeDisplay(60)).toBe('1:00')
    expect(formatTimeDisplay(90)).toBe('1:30')
    expect(formatTimeDisplay(3600)).toBe('1:00:00')
    expect(formatTimeDisplay(3661)).toBe('1:01:01')
  })
})

describe('renderTime (compact style)', () => {
  test('zero and seconds-only values', () => {
    expect(renderTime(0)).toBe('0s')
    expect(renderTime(45)).toBe('45s')
  })

  test('drops seconds once minutes or hours exist', () => {
    expect(renderTime(90)).toBe('1m')
    expect(renderTime(3600)).toBe('1h')
    expect(renderTime(3630)).toBe('1h')
    expect(renderTime(3900)).toBe('1h 5m')
  })
})
