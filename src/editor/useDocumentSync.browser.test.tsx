import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createStore } from 'jotai'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom } from './state'
import { openDocumentOutbox } from './document-outbox'
import { useDocumentSync } from './useDocumentSync'

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  load: vi.fn(),
  notifications: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: () => {} }))
vi.mock('@/lib/notifications', () => ({
  notifications: { error: mocks.notifications, info: mocks.notifications },
}))
vi.mock('@/api/client', () => ({
  orpcClient: {},
  orpc: {
    analysis: { key: () => ['analysis'] },
    doc: {
      patchDoc: {
        call: mocks.patch,
        mutationOptions: () => ({ mutationFn: mocks.patch }),
      },
      loadDoc: {
        queryOptions: ({ input, ...options }: { input: { name: string } }) => ({
          queryKey: ['doc', input],
          queryFn: mocks.load,
          ...options,
        }),
        queryKey: ({ input }: { input: { name: string } }) => ['doc', input],
        key: () => ['doc'],
      },
    },
  },
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('StrictMode restores an offline draft before hydration and reconnect saves it with the original request ID', async () => {
  const title = crypto.randomUUID()
  const scope = `${import.meta.env.BASE_URL}:${import.meta.env.TEKNE_DEMO ? 'demo' : import.meta.env.TEKNE_ORPC_URL || '/api/rpc'}`
  const original = docMake([lineMake(0, 'server text')])
  const local = docMake([
    { ...original.children[0], mdContent: 'recover this edit' },
  ])
  const requestId = crypto.randomUUID()
  const prior = await openDocumentOutbox(title, scope)
  await prior.write({
    baseline: original,
    snapshot: local,
    revision: 3,
    generation: 1,
    ackedGeneration: 0,
    conflict: null,
    attempt: { snapshot: local, generation: 1, revision: 3, requestId },
  })
  prior.close()
  mocks.load.mockRejectedValue(new Error('offline'))
  mocks.patch.mockRejectedValueOnce(new Error('offline'))
  mocks.patch.mockResolvedValue({ status: 'ok', revision: 4 })
  const store = createStore()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const { result, unmount } = renderHook(() => useDocumentSync(title, store), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </StrictMode>
    ),
  })
  await waitFor(() => expect(store.get(docAtom)).toEqual(local))
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  expect(result.current.loadDocQuery.isSuccess).toBe(true)
  expect(mocks.load).not.toHaveBeenCalled()
  await waitFor(() => expect(mocks.notifications).toHaveBeenCalled())
  await act(async () => {
    window.dispatchEvent(new Event('online'))
  })
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2))
  expect(mocks.patch.mock.calls[0][0].requestId).toBe(requestId)
  expect(mocks.patch.mock.calls[1][0]).toEqual(mocks.patch.mock.calls[0][0])
  await act(() => result.current.flushDocument())
  expect(store.get(docAtom)).toEqual(local)
  unmount()
  // Let the hook finish releasing its ownership lock and committing cleanup.
  await expect
    .poll(
      async () =>
        (await navigator.locks.query()).held?.filter((lock) =>
          lock.name?.startsWith('tekne-draft:')
        ).length
    )
    .toBe(0)
  const clean = await openDocumentOutbox(title, scope)
  expect(clean.recovered).toBeNull()
  clean.close()
})
