import { atom } from 'jotai'

export const documentMutationPendingAtom = atom(false)

export const syncedDocumentAtom = atom<{
  title: string
  revision: number
} | null>(null)
