import { parseQuery, tokenize } from './query-parser'
import type { SearchOperator } from './types'

export type ReportOperator =
  | SearchOperator
  | {
      type: 'day'
      field: 'created' | 'updated'
      from: string
      to: string
    }

export function parseReportQuery(
  query: string,
  timezone: string,
  now = new Date()
) {
  // Validate the timezone and resolve relative dates once per request.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const resolve = (value: string) =>
    value === 'today'
      ? today
      : value === 'yesterday'
        ? yesterday.toISOString().slice(0, 10)
        : value
  const date = (value: string) => {
    const resolved = resolve(value)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(resolved) ||
      !Number.isFinite(Date.parse(resolved)) ||
      new Date(resolved).toISOString().slice(0, 10) !== resolved
    ) {
      throw new Error(
        `Invalid date: ${value}. Use today, yesterday, or YYYY-MM-DD`
      )
    }
    return resolved
  }
  if ((query.match(/"/g)?.length ?? 0) % 2) throw new Error('Unclosed quote')
  const operators: ReportOperator[] = []
  for (const token of tokenize(query.trim())) {
    if (/^\w+:$/.test(token)) throw new Error(`Missing value: ${token}`)
    const match = /^(created|updated):(.+)$/i.exec(token)
    if (match) {
      const parts = match[2].split('..')
      if (parts.length > 2) throw new Error(`Invalid date range: ${match[2]}`)
      const from = date(parts[0])
      const to = date(parts[1] ?? parts[0])
      if (from > to) throw new Error('Date range starts after it ends')
      operators.push({
        type: 'day',
        field: match[1].toLowerCase() as 'created' | 'updated',
        from,
        to,
      })
      continue
    }
    const doc = /^doc:(.+)$/i.exec(token)
    if (doc) {
      operators.push({
        type: 'doc',
        value: resolve(doc[1].replace(/^"|"$/g, '')),
      })
      continue
    }
    const normalized = token.replace(
      /^(from|to):(.+)$/i,
      (_, op: string, value: string) =>
        `${op}:${resolve(value.replace(/^"|"$/g, ''))}`
    )
    const parsed = parseQuery(normalized)
    if (parsed.errors.length)
      throw new Error(parsed.errors.map((e) => e.message).join('; '))
    for (const op of parsed.operators) {
      if (
        op.type === 'age' &&
        !Number.isFinite(
          new Date(now.getTime() - op.value * 86400000).getTime()
        )
      )
        throw new Error('Age is too large')
      if (op.type === 'doc') op.value = op.value.replace(/^"|"$/g, '')
      if (op.type === 'tag' && !op.value.startsWith('#'))
        op.value = `#${op.value}`
      operators.push(op)
    }
  }
  return { operators, today }
}
