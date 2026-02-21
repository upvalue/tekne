import { atom, useAtomValue } from 'jotai'
import { atomWithQuery } from 'jotai-tanstack-query'
import { trpcClient } from '@/trpc/client'

export const featureFlagsAtom = atomWithQuery(() => ({
  queryKey: ['featureFlags'],
  queryFn: () => trpcClient.flags.getAll.query(),
  refetchInterval: 60 * 1000,
}))

/**
 * Synchronous boolean atom for whether document undo is enabled.
 * Updated when the flags query resolves. Used by the undo system
 * to avoid async reads in atom write paths.
 */
export const documentUndoEnabledAtom = atom<boolean>(false)

export const useFeatureFlag = (key: string): boolean => {
  const flags = useAtomValue(featureFlagsAtom)
  if (flags.isLoading || flags.isError || !flags.data) return false
  return !!flags.data[key]
}
