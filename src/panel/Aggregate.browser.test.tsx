import { cleanup, render } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Aggregate } from './Aggregate'
import { ResultCardGrid, type ResultCardData } from './AggregateComponents'
import '@/styles/styles.css'

const fixture = vi.hoisted(() => ({ data: [] as ResultCardData[] }))

vi.mock('@/hooks/useDocTitle', () => ({ useDocTitle: () => 'mobile-layout' }))
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  orpc: {
    analysis: {
      aggregateData: {
        queryOptions: () => ({
          queryKey: ['aggregate-layout'],
          queryFn: async () => fixture.data,
          initialData: fixture.data,
          staleTime: Infinity,
        }),
      },
    },
  },
}))

afterEach(async () => {
  cleanup()
  await page.viewport(1280, 800)
})

test.each([
  { viewport: 320, panel: 270, columns: 1 },
  { viewport: 390, panel: 340, columns: 1 },
  { viewport: 1280, panel: 270, columns: 1 },
  { viewport: 1280, panel: 520, columns: 2 },
])(
  'aggregate cards fit a $panel content width in $columns column(s)',
  async ({ viewport, panel, columns }) => {
    await page.viewport(viewport, 800)
    fixture.data = [
      {
        tag: 'project',
        complete_tasks: 12,
        incomplete_tasks: 3,
        unset_tasks: 4,
        total_time_seconds: 5400,
      },
      {
        tag: 'unbrokentag'.repeat(20),
        complete_tasks: 123456,
        incomplete_tasks: 234567,
        unset_tasks: 345678,
        total_time_seconds: 360000,
        page_complete_tasks: 456789,
        page_incomplete_tasks: 567890,
        page_unset_tasks: 678901,
        page_time_seconds: 720000,
        pinned_at: '2026-10-03',
        pinned_desc: 'unbrokendescription'.repeat(20),
      },
      { tag: 'tag-only' },
    ]
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        {/* A 320px panel leaves 270px after its rail and outer border. */}
        <div style={{ width: panel }}>
          <Aggregate />
        </div>
      </QueryClientProvider>
    )
    const list = view.getByRole('list', { name: 'Tag aggregates' })
    const listBounds = list.getBoundingClientRect()
    expect(listBounds.width).toBe(panel - 24)
    const rows = view.getAllByRole('listitem')
    for (const row of rows) {
      const card = row.firstElementChild as HTMLElement
      const bounds = card.getBoundingClientRect()
      expect(bounds.left).toBeGreaterThanOrEqual(listBounds.left)
      expect(bounds.right).toBeLessThanOrEqual(listBounds.right)
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
      expect(getComputedStyle(card).borderWidth).toBe('0px')
      for (const element of card.querySelectorAll('span, p, svg')) {
        expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(
          bounds.right
        )
      }
    }
    const lefts = new Set(
      rows.map((row) => Math.round(row.getBoundingClientRect().left))
    )
    expect(lefts.size).toBe(columns)
    const metrics = Array.from(
      rows[0].querySelectorAll<HTMLElement>(
        '[aria-label="All-time totals"] > span'
      )
    ).map((element) => element.getBoundingClientRect())
    for (let i = 1; i < metrics.length; i++) {
      const previous = metrics[i - 1]
      const current = metrics[i]
      expect(
        current.top >= previous.bottom || current.left >= previous.right
      ).toBe(true)
    }
    const description = view.getByText(fixture.data[1].pinned_desc!)
    expect(description.getBoundingClientRect().height).toBeGreaterThan(20)
  }
)

test('empty aggregate retains one inset and wraps within a small panel', async () => {
  await page.viewport(320, 800)
  fixture.data = []
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <div style={{ width: 270 }}>
        <Aggregate />
      </div>
    </QueryClientProvider>
  )
  const empty = view.getByText(
    'No tags with data in current document'
  ).parentElement!
  expect(getComputedStyle(empty).paddingLeft).toBe('12px')
  expect(empty.scrollWidth).toBeLessThanOrEqual(empty.clientWidth)
  expect(view.queryByRole('list')).toBeNull()
})

test('search cards stack in a narrow panel without borders or extra inset', () => {
  const view = render(
    <div style={{ width: 270 }}>
      <ResultCardGrid data={[{ tag: 'search-one' }, { tag: 'search-two' }]} />
    </div>
  )
  const rows = view.getAllByRole('listitem')
  expect(rows[1].getBoundingClientRect().top).toBeGreaterThanOrEqual(
    rows[0].getBoundingClientRect().bottom
  )
  expect(view.getByRole('list').getBoundingClientRect().width).toBe(270)
  expect(getComputedStyle(rows[0].firstElementChild!).borderLeftWidth).toBe(
    '0px'
  )
})
