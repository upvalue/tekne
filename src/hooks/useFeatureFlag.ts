import { useAtomValue } from 'jotai'
import { atomWithQuery } from 'jotai-tanstack-query'
import { trpcClient } from '@/trpc/client'

export const featureFlagsAtom = atomWithQuery(() => ({
  queryKey: ['featureFlags'],
  queryFn: () => trpcClient.flags.getAll.query(),
  refetchInterval: 60 * 1000,
}))

export const useFeatureFlag = (key: string): boolean => {
  const flags = useAtomValue(featureFlagsAtom)
  if (flags.isLoading || flags.isError || !flags.data) return false
  return !!flags.data[key]
}
