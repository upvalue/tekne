// query-parser.test.ts - Unit tests for search query parser

import { describe, it, expect } from 'vitest'
import { parseQuery, serializeQuery } from './query-parser'

describe('parseQuery', () => {
  describe('tag operator', () => {
    it('should parse #tag syntax', () => {
      const result = parseQuery('#exercise')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'tag', value: '#exercise' })
      expect(result.errors).toHaveLength(0)
    })

    it('should parse #tag with slash', () => {
      const result = parseQuery('#proj/tekne')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'tag', value: '#proj/tekne' })
    })

    it('should parse multiple #tags', () => {
      const result = parseQuery('#exercise #fitness')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'tag', value: '#exercise' })
      expect(result.operators[1]).toEqual({ type: 'tag', value: '#fitness' })
    })
  })

  describe('from/to operators', () => {
    it('should parse from date', () => {
      const result = parseQuery('from:2026-01-02')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0].type).toBe('from')
      const op = result.operators[0] as { type: 'from'; value: Date }
      expect(op.value.getFullYear()).toBe(2026)
      expect(op.value.getMonth()).toBe(0) // January
      expect(op.value.getDate()).toBe(2)
    })

    it('should parse to date', () => {
      const result = parseQuery('to:2026-01-15')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0].type).toBe('to')
    })

    it('should error on invalid date format', () => {
      const result = parseQuery('from:01-02-2026')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Invalid date format')
    })

    it('should error on invalid date (e.g., Feb 30)', () => {
      const result = parseQuery('from:2026-02-30')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('age operator', () => {
    it('should parse age in days', () => {
      const result = parseQuery('age:90d')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'age', value: 90 })
    })

    it('should parse age in weeks', () => {
      const result = parseQuery('age:2w')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'age', value: 14 })
    })

    it('should parse age in months', () => {
      const result = parseQuery('age:3m')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'age', value: 90 })
    })

    it('should error on invalid age format', () => {
      const result = parseQuery('age:90')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Invalid age format')
    })
  })

  describe('status operator', () => {
    it('should parse complete status', () => {
      const result = parseQuery('status:complete')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'status', value: 'complete' })
    })

    it('should parse incomplete status', () => {
      const result = parseQuery('status:incomplete')
      expect(result.operators[0]).toEqual({
        type: 'status',
        value: 'incomplete',
      })
    })

    it('should parse unset status', () => {
      const result = parseQuery('status:unset')
      expect(result.operators[0]).toEqual({ type: 'status', value: 'unset' })
    })

    it('should error on invalid status', () => {
      const result = parseQuery('status:done')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Invalid status')
    })
  })

  describe('has operator', () => {
    it('should parse has:timer', () => {
      const result = parseQuery('has:timer')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'has', value: 'timer' })
    })

    it('should parse has:task', () => {
      const result = parseQuery('has:task')
      expect(result.operators[0]).toEqual({ type: 'has', value: 'task' })
    })

    it('should parse has:pin', () => {
      const result = parseQuery('has:pin')
      expect(result.operators[0]).toEqual({ type: 'has', value: 'pin' })
    })

    it('should error on invalid has value', () => {
      const result = parseQuery('has:bookmark')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Invalid has value')
    })
  })

  describe('doc operator', () => {
    it('should parse doc pattern', () => {
      const result = parseQuery('doc:2026-01-*')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'doc', value: '2026-01-*' })
    })
  })

  describe('text search', () => {
    it('should parse bare text as full-text search', () => {
      const result = parseQuery('meeting notes')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({
        type: 'text',
        value: 'meeting',
        wildcard: 'none',
      })
      expect(result.operators[1]).toEqual({
        type: 'text',
        value: 'notes',
        wildcard: 'none',
      })
    })

    it('should handle quoted text', () => {
      const result = parseQuery('"meeting notes"')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({
        type: 'text',
        value: 'meeting notes',
        wildcard: 'none',
      })
    })

    it('should parse prefix wildcard', () => {
      const result = parseQuery('run*')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({
        type: 'text',
        value: 'run',
        wildcard: 'prefix',
      })
    })

    it('should parse suffix wildcard', () => {
      const result = parseQuery('*ing')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({
        type: 'text',
        value: 'ing',
        wildcard: 'suffix',
      })
    })

    it('should parse contains wildcard', () => {
      const result = parseQuery('*run*')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({
        type: 'text',
        value: 'run',
        wildcard: 'none',
      })
    })
  })

  describe('combined operators', () => {
    it('should parse multiple operators', () => {
      const result = parseQuery('age:90d #exercise status:complete')
      expect(result.operators).toHaveLength(3)
      expect(result.operators[0]).toEqual({ type: 'age', value: 90 })
      expect(result.operators[1]).toEqual({ type: 'tag', value: '#exercise' })
      expect(result.operators[2]).toEqual({
        type: 'status',
        value: 'complete',
      })
    })

    it('should parse mixed operators and text', () => {
      const result = parseQuery('#proj/tekne refactor')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'tag', value: '#proj/tekne' })
      expect(result.operators[1]).toEqual({
        type: 'text',
        value: 'refactor',
        wildcard: 'none',
      })
    })
  })

  describe('error handling', () => {
    it('should handle unknown operators', () => {
      const result = parseQuery('unknown:value')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Unknown operator')
    })

    it('should continue parsing after error', () => {
      const result = parseQuery('unknown:value #exercise')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'tag', value: '#exercise' })
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('should handle empty query', () => {
      const result = parseQuery('')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle whitespace-only query', () => {
      const result = parseQuery('   ')
      expect(result.operators).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should be case-insensitive for operators', () => {
      const result = parseQuery('AGE:90d STATUS:Complete')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'age', value: 90 })
      expect(result.operators[1]).toEqual({
        type: 'status',
        value: 'complete',
      })
    })
  })
})

describe('serializeQuery', () => {
  it('should serialize tag operator with # prefix', () => {
    const result = serializeQuery([{ type: 'tag', value: '#exercise' }])
    expect(result).toBe('#exercise')
  })

  it('should add # prefix if missing when serializing tag', () => {
    const result = serializeQuery([{ type: 'tag', value: 'exercise' }])
    expect(result).toBe('#exercise')
  })

  it('should serialize age operator', () => {
    const result = serializeQuery([{ type: 'age', value: 90 }])
    expect(result).toBe('age:90d')
  })

  it('should serialize from/to operators', () => {
    const date = new Date(2026, 0, 15) // Jan 15, 2026
    const result = serializeQuery([{ type: 'from', value: date }])
    expect(result).toBe('from:2026-01-15')
  })

  it('should serialize text with spaces in quotes', () => {
    const result = serializeQuery([
      { type: 'text', value: 'meeting notes', wildcard: 'none' },
    ])
    expect(result).toBe('"meeting notes"')
  })

  it('should serialize text without spaces without quotes', () => {
    const result = serializeQuery([
      { type: 'text', value: 'meeting', wildcard: 'none' },
    ])
    expect(result).toBe('meeting')
  })

  it('should serialize text with prefix wildcard', () => {
    const result = serializeQuery([
      { type: 'text', value: 'run', wildcard: 'prefix' },
    ])
    expect(result).toBe('run*')
  })

  it('should serialize text with suffix wildcard', () => {
    const result = serializeQuery([
      { type: 'text', value: 'ing', wildcard: 'suffix' },
    ])
    expect(result).toBe('*ing')
  })

  it('should serialize multiple operators', () => {
    const result = serializeQuery([
      { type: 'tag', value: '#exercise' },
      { type: 'status', value: 'complete' },
    ])
    expect(result).toBe('#exercise status:complete')
  })
})
