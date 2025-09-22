import { atom, useAtom, useStore } from 'jotai'
import { withImmer } from 'jotai-immer'
import { lineMake, type ZDoc, type ZLine } from '@/docs/schema'
import { useCallback } from 'react'
import { atomWithQuery } from 'jotai-tanstack-query'
import { trpcClient } from '@/trpc/client'
import { noop } from 'lodash-es'
import { produce } from 'immer'

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
  timeMode: 'additive' | 'replacement'
  startTime: number | null
  targetDuration: number
  elapsedTime: number
  stopTimer: () => void
  interval: NodeJS.Timeout | null
}

/**
 * Global timer state -- contains information about the
 * active timer (if there is one) and allows it to be
 * stopped from anywhere
 */
export const globalTimerAtom = atom<GlobalTimerState>({
  isActive: false,
  lineIdx: null,
  lineContent: null,
  mode: 'stopwatch',
  timeMode: 'replacement',
  startTime: null,
  targetDuration: 25 * 60,
  elapsedTime: 0,
  stopTimer: noop,
  interval: null,
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
 * Update a line in the document outside of the React tree
 */
export const setDocLineDirect = (
  store: ReturnType<typeof useStore>,
  lineIdx: number,
  callback: (line: ZLine) => void
) => {
  store.set(
    docAtom,
    produce(store.get(docAtom), (draft) => {
      callback(draft.children[lineIdx])
    })
  )
}

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
