import { describe, it, expect } from 'vitest'
import {
  parseDirectives,
  parseDayOfWeekArgs,
  matchesDayOfWeek,
  applyTemplateDirectives,
} from '@/docs/template-directives'
import { lineMake } from '@/docs/schema'

describe('parseDirectives', () => {
  it('returns empty directives for plain content', () => {
    const result = parseDirectives('Hello world')
    expect(result.directives).toEqual([])
    expect(result.content).toBe('Hello world')
  })

  it('parses a single directive', () => {
    const result = parseDirectives('@dayofweek(fri) Submit report')
    expect(result.directives).toEqual([{ name: 'dayofweek', args: 'fri' }])
    expect(result.content).toBe('Submit report')
  })

  it('parses multiple directives', () => {
    const result = parseDirectives('@dayofweek(fri) @other(arg) Content')
    expect(result.directives).toEqual([
      { name: 'dayofweek', args: 'fri' },
      { name: 'other', args: 'arg' },
    ])
    expect(result.content).toBe('Content')
  })

  it('does not match email addresses', () => {
    const result = parseDirectives('email@test.com')
    expect(result.directives).toEqual([])
    expect(result.content).toBe('email@test.com')
  })

  it('does not match @-mentions without parens', () => {
    const result = parseDirectives('@3pm meeting')
    expect(result.directives).toEqual([])
    expect(result.content).toBe('@3pm meeting')
  })

  it('handles directive with no trailing content', () => {
    const result = parseDirectives('@dayofweek(mon)')
    expect(result.directives).toEqual([{ name: 'dayofweek', args: 'mon' }])
    expect(result.content).toBe('')
  })
})

describe('parseDayOfWeekArgs', () => {
  it('parses a single day', () => {
    const result = parseDayOfWeekArgs('fri')
    expect(result).toEqual(new Set(['fri']))
  })

  it('parses a comma list', () => {
    const result = parseDayOfWeekArgs('sat,sun')
    expect(result).toEqual(new Set(['sat', 'sun']))
  })

  it('parses a range', () => {
    const result = parseDayOfWeekArgs('mon-fri')
    expect(result).toEqual(new Set(['mon', 'tue', 'wed', 'thu', 'fri']))
  })

  it('parses mixed range and individual days', () => {
    const result = parseDayOfWeekArgs('mon-wed,fri')
    expect(result).toEqual(new Set(['mon', 'tue', 'wed', 'fri']))
  })
})

describe('matchesDayOfWeek', () => {
  // 2026-02-14 is a Saturday
  const saturday = new Date('2026-02-14T00:00:00')
  // 2026-02-13 is a Friday
  const friday = new Date('2026-02-13T00:00:00')

  it('matches saturday against sat', () => {
    expect(matchesDayOfWeek('sat', saturday)).toBe(true)
  })

  it('matches saturday against sat,sun', () => {
    expect(matchesDayOfWeek('sat,sun', saturday)).toBe(true)
  })

  it('does not match saturday against mon-fri', () => {
    expect(matchesDayOfWeek('mon-fri', saturday)).toBe(false)
  })

  it('matches friday against fri', () => {
    expect(matchesDayOfWeek('fri', friday)).toBe(true)
  })

  it('matches friday against mon-fri', () => {
    expect(matchesDayOfWeek('mon-fri', friday)).toBe(true)
  })

  it('does not match friday against sat,sun', () => {
    expect(matchesDayOfWeek('sat,sun', friday)).toBe(false)
  })
})

describe('applyTemplateDirectives', () => {
  // 2026-02-14 is a Saturday
  const saturday = new Date('2026-02-14T00:00:00')

  it('passes through lines without directives', () => {
    const lines = [lineMake(0, 'Morning routine'), lineMake(1, 'Exercise')]
    const result = applyTemplateDirectives(lines, saturday)
    expect(result).toHaveLength(2)
    expect(result[0].mdContent).toBe('Morning routine')
    expect(result[1].mdContent).toBe('Exercise')
  })

  it('includes matching lines with directive stripped', () => {
    const lines = [
      lineMake(1, '@dayofweek(sat,sun) Weekend project #personal'),
    ]
    const result = applyTemplateDirectives(lines, saturday)
    expect(result).toHaveLength(1)
    expect(result[0].mdContent).toBe('Weekend project #personal')
  })

  it('excludes non-matching lines', () => {
    const lines = [
      lineMake(1, '@dayofweek(fri) Submit weekly report [ ]'),
    ]
    const result = applyTemplateDirectives(lines, saturday)
    expect(result).toHaveLength(0)
  })

  it('handles the full example from the plan', () => {
    const lines = [
      lineMake(0, 'Morning routine'),
      lineMake(1, 'Exercise'),
      lineMake(1, '@dayofweek(fri) Submit weekly report [ ]'),
      lineMake(1, '@dayofweek(sat,sun) Weekend project #personal'),
      lineMake(1, '@dayofweek(mon-fri) Standup #work'),
    ]
    const result = applyTemplateDirectives(lines, saturday)
    expect(result).toHaveLength(3)
    expect(result[0].mdContent).toBe('Morning routine')
    expect(result[1].mdContent).toBe('Exercise')
    expect(result[2].mdContent).toBe('Weekend project #personal')
  })

  it('preserves indent and other line properties', () => {
    const lines = [
      lineMake(2, '@dayofweek(sat) Indented task', {
        datumTaskStatus: 'incomplete',
      }),
    ]
    const result = applyTemplateDirectives(lines, saturday)
    expect(result).toHaveLength(1)
    expect(result[0].indent).toBe(2)
    expect(result[0].datumTaskStatus).toBe('incomplete')
    expect(result[0].mdContent).toBe('Indented task')
  })

  it('applies AND semantics for multiple directives', () => {
    // Saturday matches sat but not fri — AND means both must match
    const lines = [
      lineMake(0, '@dayofweek(sat) @dayofweek(fri) Both needed'),
    ]
    const result = applyTemplateDirectives(lines, saturday)
    expect(result).toHaveLength(0)
  })
})
