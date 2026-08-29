import { act, renderHook } from '@testing-library/react'
import { createStore } from 'jotai'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { docAtom } from './state'
import { SAVE_DEBOUNCE_MS } from './save-queue'
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

vi.mock('@/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      analysis: { aggregateData: { invalidate: vi.fn() } },
      doc: {
        loadDoc: {
          invalidate: vi.fn(),
          setData: mocks.setData,
        },
      },
    }),
    doc: {
      updateDoc: {
        useMutation: () => ({ mutateAsync: mocks.mutateAsync }),
      },
      loadDoc: {
        useQuery: () => mocks.loadDocQuery,
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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

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
    const { result } = renderHook(() =>
      useDocumentSync('missing document', createStore())
    )

    await act(() => result.current.flushDocument())

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  test('hydration alone never saves', async () => {
    loadedDoc()
    const store = createStore()
    renderHook(() => useDocumentSync('Doc', store))

    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 10))

    expect(store.get(docAtom).children[0].mdContent).toBe('from server')
    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  test('an edit saves after the debounce and updates the query cache', async () => {
    loadedDoc()
    mocks.mutateAsync.mockResolvedValue({ status: 'ok', revision: 4 })
    const store = createStore()
    renderHook(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'edited')]))
    })
    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS))

    expect(mocks.mutateAsync).toHaveBeenCalledOnce()
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      name: 'Doc',
      doc: expect.objectContaining({ type: 'doc' }),
      expectedRevision: 3,
    })
    expect(mocks.setData).toHaveBeenCalledWith(
      { name: 'Doc' },
      expect.objectContaining({ revision: 4 })
    )
  })

  test('a failed flush keeps the document dirty and rejects', async () => {
    loadedDoc()
    mocks.mutateAsync.mockRejectedValue(new Error('network down'))
    const store = createStore()
    const { result } = renderHook(() => useDocumentSync('Doc', store))

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
    const { result } = renderHook(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'my version')]))
    })
    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS))

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
    const { result } = renderHook(() => useDocumentSync('Doc', store))

    act(() => {
      store.set(docAtom, docMake([lineMake(0, 'my version')]))
    })
    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS))
    expect(result.current.conflict).not.toBeNull()

    await act(async () => {
      result.current.resolveConflict('keepMine')
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.conflict).toBeNull()
    expect(store.get(docAtom).children[0].mdContent).toBe('my version')
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
      name: 'Doc',
      doc: expect.objectContaining({ type: 'doc' }),
      expectedRevision: 9,
    })
  })
})
