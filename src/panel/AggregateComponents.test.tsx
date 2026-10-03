import { cleanup, render, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { AggregateList, ResultCardGrid } from './AggregateComponents'

afterEach(cleanup)

test('aggregate rows retain task, time, page contribution, and pinned data', () => {
  const view = render(
    <AggregateList
      data={[
        {
          tag: 'project',
          complete_tasks: 12,
          incomplete_tasks: 3,
          unset_tasks: 4,
          total_time_seconds: 5400,
          page_complete_tasks: 5,
          page_incomplete_tasks: 6,
          page_unset_tasks: 7,
          page_time_seconds: 600,
          pinned_at: '2026-10-03',
          pinned_desc: 'A longer project description',
        },
      ]}
    />
  )
  const row = within(view.getByRole('listitem'))
  for (const text of [
    'project',
    '12',
    '3',
    '4',
    '1h 30m',
    '5',
    '6',
    '7',
    '10m',
    'A longer project description',
  ]) {
    expect(row.getByText(text)).not.toBeNull()
  }
})

test('sparse and zero-value rows have no empty metric or description blocks', () => {
  const view = render(
    <AggregateList
      data={[
        { tag: 'tag-only' },
        {
          tag: 'zeros',
          complete_tasks: 0,
          incomplete_tasks: 0,
          unset_tasks: 0,
          total_time_seconds: 0,
          page_complete_tasks: 0,
          page_time_seconds: 0,
          pinned_desc: 'Unpinned description',
        },
      ]}
    />
  )
  expect(view.getAllByRole('listitem')).toHaveLength(2)
  for (const row of view.getAllByRole('listitem')) {
    expect(row.children).toHaveLength(1)
    expect(row.querySelector('svg')).toBeNull()
    expect(row.querySelector('p')).toBeNull()
  }
  expect(view.queryByText('0')).toBeNull()
  expect(view.queryByText('Unpinned description')).toBeNull()
})

test('a pinned description without metrics is still visible', () => {
  const view = render(
    <AggregateList
      data={[
        {
          tag: 'reference',
          pinned_at: '2026-10-03',
          pinned_desc: 'Useful context',
        },
      ]}
    />
  )
  expect(view.getByText('Useful context')).not.toBeNull()
  expect(view.getByRole('listitem').children).toHaveLength(2)
})

test('search aggregates keep the existing card display', () => {
  const view = render(
    <ResultCardGrid data={[{ tag: 'search', complete_tasks: 2 }]} />
  )
  expect(view.container.querySelector('.border.rounded-lg')).not.toBeNull()
  expect(view.queryByRole('list', { name: 'Tag aggregates' })).toBeNull()
})
