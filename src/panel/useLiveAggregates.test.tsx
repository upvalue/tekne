import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, focusedLineAtom, focusedPosAtom } from '@/editor/state'
import { syncedDocumentAtom } from '@/editor/document-sync-state'
import type { AggregateBaseline } from '@/docs/aggregates'
import { useLiveAggregates } from './useLiveAggregates'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/api/client', () => ({
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
          queryFn: () => mocks.fetch(input),
          ...options,
        }),
      },
    },
  },
}))
afterEach(() => {
  cleanup()
  mocks.fetch.mockReset()
})

const baseline = (tag: string, done = 10, pageDone = 3): AggregateBaseline => ({
  tag,
  complete_tasks: done,
  incomplete_tasks: 0,
  unset_tasks: 0,
  total_time_seconds: 0,
  page_complete_tasks: pageDone,
  page_incomplete_tasks: 0,
  page_unset_tasks: 0,
  page_time_seconds: 0,
  pinned_at: null,
  pinned_desc: null,
  other_pinned_at: null,
  other_pinned_desc: null,
  other_pin_line_id: null,
})
const setup = () => {
  const store = createStore()
  store.set(
    docAtom,
    docMake(
      Array.from({ length: 3 }, () =>
        lineMake(0, '#work', { datumTaskStatus: 'complete' })
      )
    )
  )
  store.set(syncedDocumentAtom, { title: 'Doc', revision: 0 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <Provider store={store}>{children}</Provider>
    </QueryClientProvider>
  )
  return { store, client, wrapper }
}

test('local edits and undo update immediately and acknowledgements do not clear the adjustment', async () => {
  mocks.fetch.mockResolvedValue({
    title: 'Doc',
    revision: 0,
    rows: [baseline('#work')],
  })
  const { store, client, wrapper } = setup()
  const { result } = renderHook(() => useLiveAggregates('Doc'), { wrapper })
  await waitFor(() => expect(result.current.data[0]?.complete_tasks).toBe(10))
  const before = store.get(docAtom)
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children.push(lineMake(0, '#work', { datumTaskStatus: 'complete' }))
    })
  )
  expect(result.current.data[0].complete_tasks).toBe(11)
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  act(() => store.set(syncedDocumentAtom, { title: 'Doc', revision: 1 }))
  expect(result.current.data[0].complete_tasks).toBe(11)
  await act(async () => {
    client.setQueryData(['snapshot', 'Doc', ['#work']], {
      title: 'Doc',
      revision: 1,
      rows: [baseline('#work', 11, 4)],
    })
  })
  expect(result.current.data[0].complete_tasks).toBe(11)
  act(() => store.set(docAtom, before))
  expect(result.current.data[0].complete_tasks).toBe(10)
})

test('new tags wait for totals while known totals remain visible, and navigation never borrows another document baseline', async () => {
  mocks.fetch.mockResolvedValueOnce({
    title: 'Doc',
    revision: 0,
    rows: [baseline('#work')],
  })
  let resolve!: (snapshot: unknown) => void
  mocks.fetch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      })
  )
  const { store, wrapper } = setup()
  const { result, rerender } = renderHook(
    ({ title }) => useLiveAggregates(title),
    { wrapper, initialProps: { title: 'Doc' } }
  )
  await waitFor(() => expect(result.current.data[0]?.complete_tasks).toBe(10))
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children.push(lineMake(0, '#new', { datumTaskStatus: 'complete' }))
    })
  )
  expect(result.current.data.find((row) => row.tag === '#new')).toBeUndefined()
  expect(
    result.current.data.find((row) => row.tag === '#work')?.complete_tasks
  ).toBe(10)
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
  expect(
    result.current.data.find((row) => row.tag === '#work')?.complete_tasks
  ).toBe(10)
  await act(async () =>
    resolve({
      title: 'Doc',
      revision: 0,
      rows: [baseline('#work'), baseline('#new', 8, 0)],
    })
  )
  await waitFor(() =>
    expect(
      result.current.data.find((row) => row.tag === '#new')?.complete_tasks
    ).toBe(9)
  )
  rerender({ title: 'Other' })
  expect(result.current.ready).toBe(false)
  expect(result.current.data).toEqual([])
  act(() => {
    store.set(
      docAtom,
      docMake([lineMake(0, '#work', { datumTaskStatus: 'complete' })])
    )
    store.set(syncedDocumentAtom, { title: 'Other', revision: 0 })
  })
  expect(result.current.data).toEqual([])
})

test('typing a new tag waits for a separator even after the query debounce', async () => {
  mocks.fetch.mockImplementation(({ tags }) =>
    Promise.resolve({
      title: 'Doc',
      revision: 0,
      rows: tags.map((tag: string) => baseline(tag, 10, 0)),
    })
  )
  const { store, wrapper } = setup()
  const { result } = renderHook(() => useLiveAggregates('Doc'), { wrapper })
  await waitFor(() => expect(result.current.data).toHaveLength(1))
  act(() => {
    store.set(focusedLineAtom, 3)
    store.set(focusedPosAtom, 5)
    store.set(docAtom, (draft) => {
      draft.children.push(lineMake(0, '#exer', { datumTimeSeconds: 60 }))
    })
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
  })
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  expect(result.current.data.map((row) => row.tag)).toEqual(['#work'])
  act(() => {
    store.set(focusedPosAtom, 9)
    store.set(docAtom, (draft) => {
      draft.children[3].mdContent = '#exercise'
    })
  })
  expect(result.current.data.map((row) => row.tag)).toEqual(['#work'])
  act(() => {
    store.set(focusedPosAtom, 10)
    store.set(docAtom, (draft) => {
      draft.children[3].mdContent = '#exercise '
    })
  })
  await waitFor(() =>
    expect(
      result.current.data.find((row) => row.tag === '#exercise')
        ?.page_time_seconds
    ).toBe(60)
  )
})
