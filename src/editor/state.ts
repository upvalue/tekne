import { atom, useAtom } from 'jotai'
import { withImmer } from 'jotai-immer'
import { lineMake, type ZDoc, type ZLine } from '@/docs/schema'
import { useCallback } from 'react'
import { atomWithQuery } from 'jotai-tanstack-query'
import { trpcClient } from '@/trpc/client'

export const docAtom = withImmer(
  atom<ZDoc>({
    type: 'doc',
    children: [lineMake(0, '')],
  } as ZDoc)
)

export const focusedLineAtom = atom<number | null>(null)

export const requestFocusLineAtom = atom({
  lineIdx: -1,
  pos: 0,
})

export const errorMessageAtom = atom<string | null>(null)

type GlobalTimerState = {
  isActive: boolean
  lineIdx: number | null
  lineContent: string | null
  mode: 'stopwatch' | 'countdown' | 'manual'
  startTime: number | null
  targetDuration: number
  elapsedTime: number
}

export const globalTimerAtom = atom<GlobalTimerState>({
  isActive: false,
  lineIdx: null,
  lineContent: null,
  mode: 'stopwatch',
  startTime: null,
  targetDuration: 25 * 60,
  elapsedTime: 0,
})

export const notificationPermissionAtom = atom<NotificationPermission | null>(
  null
)

export const allTagsAtom = atomWithQuery(() => ({
  queryKey: ['allTags'],
  queryFn: () => {
    return trpcClient.doc.allTags.query()
  },
  // every 5 minutes
  refetchInterval: 60 * 5 * 1000,
}))

/**
 * Allows reading or modifying a specific line
 * in the document
 */
export const useDocLine = (
  lineIdx: number
): [ZLine, (callback: (line: ZLine) => void) => void] => {
  const [doc, setDoc] = useAtom(docAtom)

  const setLine = useCallback(
    (callback: (line: ZLine) => void) => {
      setDoc((draft) => {
        callback(draft.children[lineIdx])
      })
    },
    [lineIdx, setDoc]
  )

  return [doc.children[lineIdx], setLine]
}
