import { act, renderHook } from '@testing-library/react'
import { createStore } from 'jotai'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom, globalTimerAtom } from './state'
import { useDocumentSync } from './useDocumentSync'

const mocks = vi.hoisted(() => ({
  loadDocQuery: {
    isLoading: false,
    data: undefined as { doc: unknown; revision: number } | undefined,
  },
  mutateAsync: vi.fn(),
  setData: vi.fn(),
  blocker: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => mocks.loadDocQuery,
  useMutation: () => ({ mutateAsync: mocks.mutateAsync }),
  useQueryClient: () => ({
    setQueryData: mocks.setData,
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('@/api/client', () => ({
  orpc: {
    analysis: { key: () => ['analysis'] },
    doc: {
      patchDoc: { mutationOptions: () => ({}) },
      loadDoc: {
        queryOptions: () => ({}),
        queryKey: ({ input }: { input: unknown }) => ['doc', input],
        key: () => ['doc'],
      },
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useBlocker: (options: unknown) => mocks.blocker(options),
}))

vi.mock('@/hooks/useEventListener', () => ({
  useEventListener: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  notifications: {
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('./document-outbox', () => ({
  openDocumentOutbox: async () => ({
    recovered: null,
    otherDrafts: 0,
    write: async () => {},
    close: () => {},
  }),
}))

const renderSync = async (fn: () => ReturnType<typeof useDocumentSync>) => {
  const view = renderHook(fn)
  await act(async () => {})
  return view
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.loadDocQuery.isLoading = false
  mocks.loadDocQuery.data = undefined
  mocks.mutateAsync.mockReset()
  mocks.setData.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const loadedDoc = () => {
  mocks.loadDocQuery.data = {
    doc: docMake([lineMake(0, 'from server')]),
    revision: 3,
  }
}

describe('useDocumentSync', () => {
  test('does not save the placeholder after a document load fails', async () => {
    const store = createStore()
    const { result } = await renderSync(() =>
      useDocumentSync('missing document', store)
    )

    await act(() => result.current.flushDocument())

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  test('hydration alone never saves', async () => {
    loadedDoc()
    const store = createStore()
    await renderSync(() => useDocumentSync('Doc', store))

    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(store.get(docAtom).children[0].mdContent).toBe('from server')
    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  test('an edit saves immediately and updates the query cache', async () => {
    loadedDoc()
    mocks.mutateAsync.mockResolvedValue({ status: 'ok', revision: 4 })
    const store = createStore()
    await renderSync(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'edited')]))
    })
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(mocks.mutateAsync).toHaveBeenCalledOnce()
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      name: 'Doc',
      patch: expect.any(Array),
      requestId: expect.any(String),
      expectedRevision: 3,
    })
    expect(mocks.setData).toHaveBeenCalledWith(
      ['doc', { name: 'Doc' }],
      expect.objectContaining({ revision: 4 })
    )
  })

  test('a failed flush keeps the document dirty and rejects', async () => {
    loadedDoc()
    mocks.mutateAsync.mockRejectedValue(new Error('network down'))
    const store = createStore()
    const { result } = await renderSync(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'edited')]))
    })

    await expect(act(() => result.current.flushDocument())).rejects.toThrow(
      'network down'
    )
    expect(store.get(docAtom).children[0].mdContent).toBe('edited')
  })

  test('take-server resolution replaces local content and comes back clean', async () => {
    loadedDoc()
    const serverDoc = docMake([lineMake(0, 'their version')])
    mocks.mutateAsync.mockResolvedValue({
      status: 'conflict',
      serverDoc,
      serverRevision: 9,
    })
    const store = createStore()
    const { result } = await renderSync(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'my version')]))
    })
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(result.current.conflict).not.toBeNull()

    act(() => {
      result.current.resolveConflict('takeServer')
    })

    expect(result.current.conflict).toBeNull()
    expect(store.get(docAtom).children[0].mdContent).toBe('their version')
    await act(() => result.current.flushDocument())
    // Clean after taking the server copy: no further request went out
    expect(mocks.mutateAsync).toHaveBeenCalledOnce()
  })

  test('keep-mine resolution resends the local snapshot at the server revision', async () => {
    loadedDoc()
    const serverDoc = docMake([lineMake(0, 'their version')])
    mocks.mutateAsync.mockResolvedValueOnce({
      status: 'conflict',
      serverDoc,
      serverRevision: 9,
    })
    mocks.mutateAsync.mockResolvedValueOnce({ status: 'ok', revision: 10 })
    const store = createStore()
    const { result } = await renderSync(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'my version')]))
    })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.conflict).not.toBeNull()

    await act(async () => {
      result.current.resolveConflict('keepMine')
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.conflict).toBeNull()
    expect(store.get(docAtom).children[0].mdContent).toBe('my version')
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
      name: 'Doc',
      patch: expect.any(Array),
      requestId: expect.any(String),
      expectedRevision: 9,
    })
  })
})

test('a persisted active timer does not block navigation after document edits are flushed', async () => {
  mocks.loadDocQuery.data = { doc: docMake([lineMake(0, 'task')]), revision: 0 }
  mocks.mutateAsync.mockResolvedValue({ status: 'ok', revision: 1 })
  const store = createStore()
  await renderSync(() => useDocumentSync('Doc', store))
  store.set(globalTimerAtom, (timer) => ({ ...timer, isActive: true }))
  const blocker = mocks.blocker.mock.lastCall![0] as {
    shouldBlockFn: () => Promise<boolean>
  }
  expect(await blocker.shouldBlockFn()).toBe(false)
})

test('patches retry exactly, then diff later edits against the acknowledged snapshot', async () => {
  const { applyDocumentPatch } = await import('@/docs/document-patch')
  loadedDoc()
  const before = mocks.loadDocQuery.data!.doc as ReturnType<typeof docMake>
  let reject!: (error: Error) => void
  mocks.mutateAsync.mockImplementationOnce(
    () =>
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest
      })
  )
  const store = createStore()
  const { result } = await renderSync(() => useDocumentSync('Doc', store))
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children[0].mdContent = 'first'
    })
  )
  const first = store.get(docAtom)
  await act(() => vi.advanceTimersByTimeAsync(0))
  const request = mocks.mutateAsync.mock.calls[0][0]
  expect(applyDocumentPatch(before, request.patch)).toEqual(first)
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children[0].mdContent = 'second'
    })
  )
  await act(async () => reject(new Error('lost response')))
  mocks.mutateAsync.mockResolvedValueOnce({ status: 'ok', revision: 4 })
  mocks.mutateAsync.mockResolvedValueOnce({ status: 'ok', revision: 5 })
  await act(() => result.current.flushDocument())
  expect(mocks.mutateAsync.mock.calls[1][0]).toEqual(request)
  const next = mocks.mutateAsync.mock.calls[2][0]
  expect(next.expectedRevision).toBe(4)
  expect(applyDocumentPatch(first, next.patch)).toEqual(store.get(docAtom))
  expect(next.requestId).not.toBe(request.requestId)
})
