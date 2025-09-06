// collapse.test.ts - Unit tests for collapse logic

import { describe, it, expect } from 'vitest'
import { generateCollapse } from './collapse'
import { lineMake } from './schema'

describe('generateCollapse', () => {
  it('should return all false for lines without collapsed property', () => {
    const lines = [
      lineMake(0, 'Line 1'),
      lineMake(1, 'Line 2'),
      lineMake(2, 'Line 3'),
      lineMake(1, 'Line 4'),
    ]

    const result = generateCollapse(lines)
    expect(result).toEqual([false, false, false, false])
  })

  it('should not collapse the line with collapsed=true itself', () => {
    const lines = [
      lineMake(0, 'Line 1'),
      { ...lineMake(1, 'Line 2'), collapsed: true },
      lineMake(2, 'Line 3'),
    ]

    const result = generateCollapse(lines)
    expect(result[1]).toBe(false) // The collapsed line itself should not be visually collapsed
  })

  it('should collapse lines indented past a collapsed line', () => {
    const lines = [
      lineMake(0, 'Root'),
      { ...lineMake(1, 'Parent'), collapsed: true },
      lineMake(2, 'Child 1'),
      lineMake(3, 'Grandchild'),
      lineMake(2, 'Child 2'),
    ]

    const result = generateCollapse(lines)
    expect(result).toEqual([
      false, // Root - not collapsed
      false, // Parent - collapsed line itself, not visually collapsed
      true, // Child 1 - indented past collapsed parent
      true, // Grandchild - indented past collapsed parent
      true, // Child 2 - indented past collapsed parent
    ])
  })

  it('should reset collapse when encountering a line at or before collapse level', () => {
    const lines = [
      lineMake(0, 'Root'),
      { ...lineMake(1, 'Parent'), collapsed: true },
      lineMake(2, 'Child 1'),
      lineMake(1, 'Sibling'), // Same level as collapsed parent - should reset
      lineMake(2, 'Sibling child'),
    ]

    const result = generateCollapse(lines)
    expect(result).toEqual([
      false, // Root
      false, // Parent - collapsed line itself
      true, // Child 1 - collapsed
      false, // Sibling - resets collapse
      false, // Sibling child - not collapsed (collapse was reset)
    ])
  })

  it('should handle multiple collapsed sections', () => {
    const lines = [
      lineMake(0, 'Root'),
      { ...lineMake(1, 'Parent 1'), collapsed: true },
      lineMake(2, 'Child 1'),
      lineMake(1, 'Parent 2'),
      { ...lineMake(2, 'Child 2'), collapsed: true },
      lineMake(3, 'Grandchild'),
      lineMake(1, 'Parent 3'),
    ]

    const result = generateCollapse(lines)
    expect(result).toEqual([
      false, // Root
      false, // Parent 1 - collapsed line itself
      true, // Child 1 - collapsed under Parent 1
      false, // Parent 2 - resets first collapse
      false, // Child 2 - collapsed line itself (starts new collapse)
      true, // Grandchild - collapsed under Child 2
      false, // Parent 3 - resets second collapse
    ])
  })

  it('should handle edge case with indent 0 collapsed line', () => {
    const lines = [
      { ...lineMake(0, 'Root'), collapsed: true },
      lineMake(1, 'Child'),
      lineMake(2, 'Grandchild'),
      lineMake(0, 'Another root'),
    ]

    const result = generateCollapse(lines)
    expect(result).toEqual([
      false, // Root - collapsed line itself
      true, // Child - collapsed
      true, // Grandchild - collapsed
      false, // Another root - resets collapse (same level as collapsed root)
    ])
  })

  it('should handle empty lines array', () => {
    const result = generateCollapse([])
    expect(result).toEqual([])
  })

  it('should handle single line', () => {
    const lines = [{ ...lineMake(0, 'Only line'), collapsed: true }]
    const result = generateCollapse(lines)
    expect(result).toEqual([false])
  })

  it('should reset collapse when encountering a line with lower indent', () => {
    const lines = [
      lineMake(1, 'Level 1'),
      { ...lineMake(2, 'Level 2'), collapsed: true },
      lineMake(3, 'Level 3'),
      lineMake(1, 'Back to Level 1'), // Lower than collapse level
      lineMake(2, 'Level 2 again'),
    ]

    const result = generateCollapse(lines)
    expect(result).toEqual([
      false, // Level 1
      false, // Level 2 - collapsed line itself
      true, // Level 3 - collapsed
      false, // Back to Level 1 - resets collapse (lower indent)
      false, // Level 2 again - not collapsed
    ])
  })
})
