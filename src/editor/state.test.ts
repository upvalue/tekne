import { afterEach, expect, test, vi } from 'vitest'
import { createStore } from 'jotai'
import { queryClient } from '@/lib/query-client'
import { orpcClient } from '@/api/client'
import { allTagsAtom } from './state'

vi.mock('@/api/client', () => ({
  orpcClient: { tags: { allTags: vi.fn() } },
}))

afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

test('app invalidation refreshes tag autocomplete in every document store', async () => {
  const fetchTags = vi
    .mocked(orpcClient.tags.allTags)
    .mockResolvedValue(['work'])
  const stores = [createStore(), createStore()]
  const unsubscribe = stores.map((store) => store.sub(allTagsAtom, () => {}))
  try {
    await vi.waitFor(() => {
      for (const store of stores)
        expect(store.get(allTagsAtom).data).toEqual(['work'])
    })
    const callsBefore = fetchTags.mock.calls.length
    fetchTags.mockResolvedValue([])
    await queryClient.invalidateQueries({ queryKey: ['allTags'] })
    await vi.waitFor(() => {
      expect(fetchTags.mock.calls.length).toBeGreaterThan(callsBefore)
      for (const store of stores)
        expect(store.get(allTagsAtom).data).toEqual([])
    })
  } finally {
    unsubscribe.forEach((stop) => stop())
  }
})
