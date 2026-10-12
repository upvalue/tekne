import { getDefaultStore, useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
const uiStore = getDefaultStore()

export type LoadingStyle = 'spinner' | 'dots' | 'pulse'
const loadingStyleAtom = atomWithStorage<LoadingStyle>(
  'tekne.loadingStyle',
  'spinner'
)
export const useLoadingStyle = () =>
  useAtom(loadingStyleAtom, { store: uiStore })
