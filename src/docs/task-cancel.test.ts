import { describe, expect, test } from 'vitest'
import { docMake, lineMake } from './schema'
import { cancelUncheckedTasksBefore } from './task-cancel'

const line = (
  timeCreated: string,
  status?: 'complete' | 'incomplete' | 'unset'
) =>
  lineMake(0, `task ${timeCreated}`, {
    timeCreated,
    timeUpdated: '2025-06-01T12:00:00.000Z',
    datumTaskStatus: status,
  })

describe('cancelUncheckedTasksBefore', () => {
  test('cancels only unchecked tasks strictly older than the cutoff', () => {
    const doc = docMake([
      line('2025-01-01T00:00:00.000Z', 'unset'),
      line('2025-02-01T00:00:00.000Z', 'unset'),
      line('2025-03-01T00:00:00.000Z', 'unset'),
      line('2025-01-01T00:00:00.001Z', 'complete'),
      line('2025-01-01T00:00:00.002Z', 'incomplete'),
      line('2025-01-01T00:00:00.003Z'),
    ])

    const result = cancelUncheckedTasksBefore(
      doc,
      new Date('2025-02-01T00:00:00.000Z')
    )

    expect(result.doc.children.map((item) => item.datumTaskStatus)).toEqual([
      'incomplete',
      'unset',
      'unset',
      'complete',
      'incomplete',
      undefined,
    ])
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      kind: 'changed',
      before: { datumTaskStatus: 'unset' },
      after: { datumTaskStatus: 'incomplete' },
    })
  })

  test('preserves all fields other than task status', () => {
    const original = line('2025-01-01T00:00:00.000Z', 'unset')
    original.indent = 2
    original.datumTimeSeconds = 90
    original.datumPinnedAt = '2025-01-02T00:00:00.000Z'
    const result = cancelUncheckedTasksBefore(
      docMake([original]),
      new Date('2025-02-01T00:00:00.000Z')
    )

    expect(result.doc.children[0]).toEqual({
      ...original,
      datumTaskStatus: 'incomplete',
    })
  })
})
