import { cleanup, fireEvent, render } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Aggregate } from './Aggregate'
import { ResultCardGrid, type ResultCardData } from './AggregateComponents'
import { DocumentOverviewSection } from './DocumentOverview'
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
  { viewport: 320, panel: 270 },
  { viewport: 390, panel: 340 },
  { viewport: 1280, panel: 270 },
])(
  'aggregate uses one inset at $viewport viewport / $panel content width',
  async ({ viewport, panel }) => {
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
          <DocumentOverviewSection label="Aggregate" flush>
            <Aggregate />
          </DocumentOverviewSection>
        </div>
      </QueryClientProvider>
    )
    const list = view.getByRole('list', { name: 'Tag aggregates' })
    const rows = view.getAllByRole('listitem')
    expect(list.getBoundingClientRect().width).toBe(panel)
    for (const row of rows) {
      const bounds = row.getBoundingClientRect()
      expect(bounds.width).toBe(panel)
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
      expect(getComputedStyle(row).paddingLeft).toBe('12px')
      expect(getComputedStyle(row).paddingRight).toBe('12px')
      expect(getComputedStyle(row).borderWidth).toBe('0px')
      expect(getComputedStyle(row).borderRadius).toBe('0px')
      for (const element of row.querySelectorAll('span, p, svg')) {
        expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(
          bounds.right - 12
        )
      }
    }
    expect(rows[1].getBoundingClientRect().top).toBe(
      rows[0].getBoundingClientRect().bottom
    )
    expect(getComputedStyle(rows[0]).backgroundColor).not.toBe(
      getComputedStyle(rows[1]).backgroundColor
    )
    expect(getComputedStyle(rows[0]).backgroundColor).toBe(
      getComputedStyle(rows[2]).backgroundColor
    )
    expect(view.getByText('12').getBoundingClientRect().top).toBe(
      view.getByText('1h 30m').getBoundingClientRect().top
    )
    const description = view.getByText(fixture.data[1].pinned_desc!)
    expect(description.getBoundingClientRect().height).toBeGreaterThan(20)

    const toggle = view.getByRole('button', { name: 'Aggregate' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(list.getClientRects()).toHaveLength(0)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(list.getBoundingClientRect().width).toBe(panel)
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

test('search result cards retain their desktop columns, border and inset', () => {
  const view = render(
    <ResultCardGrid data={[{ tag: 'search-one' }, { tag: 'search-two' }]} />
  )
  const grid = view.container.firstElementChild!
  expect(getComputedStyle(grid).columnCount).toBe('2')
  const card = view.getByText('search-one').parentElement!.parentElement!
  expect(getComputedStyle(card).paddingLeft).toBe('16px')
  expect(getComputedStyle(card).borderLeftWidth).toBe('1px')
})
