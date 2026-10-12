import { act, cleanup, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider, createStore } from 'jotai'
import { afterEach, expect, test, vi } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom } from '@/editor/state'
import { syncedDocumentAtom } from '@/editor/document-sync-state'
import { Aggregate } from './Aggregate'
import '@/styles/styles.css'

vi.mock('@/hooks/useDocTitle', () => ({ useDocTitle: () => 'Doc' }))
vi.mock('@/api/client', () => ({
  orpcClient: {},
  orpc: {
    analysis: {
      aggregateSnapshot: {
        queryOptions: ({
          input,
          ...options
        }: {
          input: { title: string; tags: string[] }
        }) => ({
          queryKey: ['snapshot', input.title, input.tags],
          queryFn: () => new Promise(() => {}),
          ...options,
        }),
      },
    },
  },
}))
afterEach(cleanup)

test('shows edits before any network response and never labels unknown totals as loading', async () => {
  const store = createStore()
  store.set(
    docAtom,
    docMake([lineMake(0, '#work', { datumTaskStatus: 'complete' })])
  )
  store.set(syncedDocumentAtom, { title: 'Doc', revision: 0 })
  const client = new QueryClient()
  client.setQueryData(['snapshot', 'Doc', ['#work']], {
    title: 'Doc',
    revision: 0,
    rows: [
      {
        tag: '#work',
        complete_tasks: 10,
        incomplete_tasks: 0,
        unset_tasks: 0,
        total_time_seconds: 0,
        page_complete_tasks: 1,
        page_incomplete_tasks: 0,
        page_unset_tasks: 0,
        page_time_seconds: 0,
        pinned_at: null,
        pinned_desc: null,
        other_pinned_at: null,
        other_pinned_desc: null,
        other_pin_line_id: null,
      },
    ],
  })
  const view = render(
    <QueryClientProvider client={client}>
      <Provider store={store}>
        <div style={{ width: 270 }}>
          <Aggregate />
        </div>
      </Provider>
    </QueryClientProvider>
  )
  expect(view.getByTitle('10 done')).toBeVisible()
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children.push(lineMake(0, '#work', { datumTaskStatus: 'complete' }))
      draft.children.push(lineMake(0, '#new', { datumTaskStatus: 'complete' }))
    })
  )
  expect(view.getByTitle('11 done')).toBeVisible()
  expect(view.getByTitle('2 done on this page')).toBeVisible()
  expect(view.getByText('#new')).toBeVisible()
  expect(view.getByTitle('1 done on this page')).toBeVisible()
  expect(view.queryByText(/loading totals/i)).toBeNull()
  expect(view.queryByRole('status')).toBeNull()
  await expect
    .poll(() => view.container.getAnimations({ subtree: true }).length)
    .toBe(0)
  for (const element of view.container.querySelectorAll<HTMLElement>('li')) {
    expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth)
  }
  // Removing a tag drops its card after the exit transition.
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children.pop()
    })
  )
  await expect.poll(() => view.queryByText('#new')).toBeNull()
})
