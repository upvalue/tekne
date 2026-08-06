import { describe, test, expect } from 'vitest'
import { resolveDisplayMode } from './display-mode'

describe('resolveDisplayMode', () => {
  test('overrides win regardless of the device', () => {
    expect(resolveDisplayMode('desktop', true, true)).toBe('desktop')
    expect(resolveDisplayMode('touch', false, false)).toBe('touch')
  })

  test('auto picks touch for narrow or coarse-pointer devices', () => {
    expect(resolveDisplayMode('auto', true, false)).toBe('touch')
    expect(resolveDisplayMode('auto', false, true)).toBe('touch')
    expect(resolveDisplayMode('auto', true, true)).toBe('touch')
    expect(resolveDisplayMode('auto', false, false)).toBe('desktop')
  })
})
