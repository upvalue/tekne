import { act, renderHook } from '@testing-library/react'
import { createStore } from 'jotai'
import { describe, expect, test, vi } from 'vitest'
import { useDocumentSync } from './useDocumentSync'

const mocks = vi.hoisted(() => ({
  loadDocQuery: {
    isLoading: false,
    data: undefined,
  },
  mutateAsync: vi.fn(),
  blocker: vi.fn(),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      analysis: { aggregateData: { invalidate: vi.fn() } },
      doc: { loadDoc: { invalidate: vi.fn() } },
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

vi.mock('usehooks-ts', () => ({
  useInterval: vi.fn(),
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

describe('useDocumentSync', () => {
  test('does not save the placeholder after a document load fails', async () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() =>
      useDocumentSync('missing document', createStore())
    )

    await act(() => result.current.saveDocument(onComplete))

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
