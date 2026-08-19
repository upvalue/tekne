import { describe, expect, test } from 'vitest'
import { scrollDeltaToReveal } from './touch-viewport'

describe('scrollDeltaToReveal', () => {
  const visible = { top: 100, bottom: 400 }

  test('does not move a line already inside the visible viewport', () => {
    expect(scrollDeltaToReveal({ top: 150, bottom: 180 }, visible)).toBe(0)
  })

  test('moves a keyboard-covered line just above the bottom margin', () => {
    expect(scrollDeltaToReveal({ top: 390, bottom: 430 }, visible)).toBe(42)
  })

  test('moves a line below browser chrome just below the top margin', () => {
    expect(scrollDeltaToReveal({ top: 90, bottom: 120 }, visible)).toBe(-22)
  })
})
