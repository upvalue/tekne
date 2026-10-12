import { atom } from 'jotai'

export const syncedDocumentAtom = atom<{
  title: string
  revision: number
} | null>(null)
