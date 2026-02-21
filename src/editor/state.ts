import { atom, useAtom, useStore } from 'jotai'
import { withImmer } from 'jotai-immer'
import { lineMake, type ZDoc, type ZLine } from '@/docs/schema'
import { useCallback } from 'react'
import { atomWithQuery } from 'jotai-tanstack-query'
import { trpcClient } from '@/trpc/client'
import { noop } from 'lodash-es'
import { produce, type Draft } from 'immer'
import {
  undoStackAtom,
  redoStackAtom,
  suppressUndoCaptureAtom,
  UNDO_STACK_LIMIT,
} from './undo'
import { documentUndoEnabledAtom } from '@/lib/feature-flags'

export const DEFAULT_COUNTDOWN_SECONDS = 30 * 60

export const rawDocAtom = withImmer(
  atom<ZDoc>({
    type: 'doc',
    children: [lineMake(0, '')],
  } as ZDoc)
)

export const docAtom = atom(
  (get) => get(rawDocAtom),
  (get, set, update: ZDoc | ((draft: Draft<ZDoc>) => void)) => {
    if (!get(suppressUndoCaptureAtom) && get(documentUndoEnabledAtom)) {
      const currentDoc = get(rawDocAtom)
      const focusedLine = get(focusedLineAtom) ?? 0
      set(undoStackAtom, (prev) => {
        const next = [...prev, { doc: currentDoc, focusedLine }]
        return next.length > UNDO_STACK_LIMIT
          ? next.slice(-UNDO_STACK_LIMIT)
          : next
      })
      set(redoStackAtom, [])
    }
    set(rawDocAtom, update)
  }
)

export const focusedLineAtom = atom<number | null>(null)

export const requestFocusLineAtom = atom({
  lineIdx: -1,
  pos: 0,
})

/**
 * Tracks whether the command palette is open
 * The focused line (if any) will render it
 */
export const commandPaletteOpenAtom = atom<boolean>(false)

export const goToLineOpenAtom = atom<boolean>(false)

export const showLineNumbersAtom = atom<boolean>(false)

export type TimerMode = 'stopwatch' | 'countdown' | 'manual'

/**
 * Request to open the timer dialog for a specific line with a specific mode.
 * TimerBadge watches this and opens when its lineIdx matches.
 */
export const timerDialogRequestAtom = atom<{
  lineIdx: number
  mode: TimerMode
} | null>(null)

export const errorMessageAtom = atom<string | null>(null)

type GlobalTimerState = {
  isActive: boolean
  lineTimeCreated: string | null
  lineContent: string | null
  mode: TimerMode
  timeMode: 'additive' | 'replacement'
  startTime: number | null
  targetDuration: number
  tick: number
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
  lineTimeCreated: null,
  lineContent: null,
  mode: 'stopwatch',
  timeMode: 'replacement',
  startTime: null,
  targetDuration: DEFAULT_COUNTDOWN_SECONDS,
  tick: 0,
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

/**
 * Find a line in the document by its timeCreated value.
 * Used by the timer system to resolve a stable line identity to a current index.
 */
export const findLineByTimeCreated = (
  doc: ZDoc,
  timeCreated: string | null
): { line: ZLine; lineIdx: number } | null => {
  if (timeCreated === null) return null
  const lineIdx = doc.children.findIndex((l) => l.timeCreated === timeCreated)
  if (lineIdx === -1) return null
  return { line: doc.children[lineIdx], lineIdx }
}
