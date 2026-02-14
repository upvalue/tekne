import type { ZLine } from '@/docs/schema'

type Directive = { name: string; args: string }

const DIRECTIVE_RE = /^@(\w+)\(([^)]*)\)\s*/

/**
 * Parse directives from the start of mdContent.
 * Directives have the form @name(args) and can be chained.
 */
function parseDirectives(mdContent: string): {
  directives: Directive[]
  content: string
} {
  const directives: Directive[] = []
  let remaining = mdContent

  let match: RegExpExecArray | null
  while ((match = DIRECTIVE_RE.exec(remaining)) !== null) {
    directives.push({ name: match[1], args: match[2] })
    remaining = remaining.slice(match[0].length)
  }

  return { directives, content: remaining }
}

type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DAY_INDEX: Record<DayOfWeek, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const JS_DAY_TO_DOW: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

/**
 * Parse day-of-week arguments. Supports:
 * - Single day: "fri"
 * - Comma list: "sat,sun"
 * - Range: "mon-fri"
 * - Mixed: "mon-wed,fri"
 */
function parseDayOfWeekArgs(args: string): Set<DayOfWeek> {
  const result = new Set<DayOfWeek>()

  for (const part of args.split(',')) {
    const trimmed = part.trim().toLowerCase()
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const startIdx = ALL_DAYS.indexOf(startStr as DayOfWeek)
      const endIdx = ALL_DAYS.indexOf(endStr as DayOfWeek)
      if (startIdx !== -1 && endIdx !== -1) {
        for (let i = startIdx; i <= endIdx; i++) {
          result.add(ALL_DAYS[i])
        }
      }
    } else {
      if (ALL_DAYS.includes(trimmed as DayOfWeek)) {
        result.add(trimmed as DayOfWeek)
      }
    }
  }

  return result
}

/**
 * Check if a date's day of week matches the given dayofweek args string.
 */
function matchesDayOfWeek(args: string, date: Date): boolean {
  const days = parseDayOfWeekArgs(args)
  const dow = JS_DAY_TO_DOW[date.getDay()]
  return days.has(dow)
}

/**
 * Apply all template directives to a list of lines, filtering and transforming
 * based on the target date.
 */
function applyTemplateDirectives(lines: ZLine[], targetDate: Date): ZLine[] {
  return lines.flatMap((line) => {
    const { directives, content } = parseDirectives(line.mdContent)

    if (directives.length === 0) {
      return [line]
    }

    // All directives must match (AND semantics)
    for (const directive of directives) {
      if (directive.name === 'dayofweek') {
        if (!matchesDayOfWeek(directive.args, targetDate)) {
          return []
        }
      }
      // Unknown directives are silently stripped
    }

    return [{ ...line, mdContent: content }]
  })
}

export {
  parseDirectives,
  parseDayOfWeekArgs,
  matchesDayOfWeek,
  applyTemplateDirectives,
  type Directive,
  type DayOfWeek,
}
