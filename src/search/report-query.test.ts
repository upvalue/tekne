import { expect, test } from 'vitest'
import { parseReportQuery } from './report-query'

test('relative days use the requested timezone, including the previous year', () => {
  const result = parseReportQuery(
    'doc:today created:yesterday updated:2025-12-01..2025-12-31',
    'America/Los_Angeles',
    new Date('2026-01-01T01:00:00Z')
  )
  expect(result.today).toBe('2025-12-31')
  expect(result.operators).toEqual([
    { type: 'doc', value: '2025-12-31' },
    { type: 'day', field: 'created', from: '2025-12-30', to: '2025-12-30' },
    { type: 'day', field: 'updated', from: '2025-12-01', to: '2025-12-31' },
  ])
})

test('quoted documents and text, bare tag values', () => {
  expect(
    parseReportQuery('doc:"My notes" "long run" tag:exercise', 'UTC').operators
  ).toEqual([
    { type: 'doc', value: 'My notes' },
    { type: 'text', value: 'long run', wildcard: 'none' },
    { type: 'tag', value: '#exercise' },
  ])
})

test('rejects invalid syntax instead of producing a broader report', () => {
  for (const query of [
    'created:2026-02-30',
    'updated:2026-10-02..2026-10-01',
    'tracked:today',
    '"unclosed',
  ]) {
    expect(() => parseReportQuery(query, 'UTC')).toThrow()
  }
  expect(() => parseReportQuery('', 'Not/AZone')).toThrow()
})
