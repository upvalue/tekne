import { atom, useAtom, useStore } from 'jotai'
import { type ZDoc, type ZLine } from '@/docs/schema'
import { useCallback } from 'react'
import { atomWithQuery } from 'jotai-tanstack-query'
import { queryClient } from '@/lib/query-client'
import { orpcClient } from '@/api/client'
import { produce, type Draft } from 'immer'
import { captureUndoEntry, suppressUndoCaptureAtom } from './undo'
import { rawDocAtom } from './doc-atoms'

export const DEFAULT_COUNTDOWN_SECONDS = 30 * 60

export {
  rawDocAtom,
  focusedLineAtom,
  focusedPosAtom,
  requestFocusLineAtom,
} from './doc-atoms'

export const docAtom = atom(
  (get) => get(rawDocAtom),
  (get, set, update: ZDoc | ((draft: Draft<ZDoc>) => void)) => {
    const currentDoc = get(rawDocAtom)
    const nextDoc =
      typeof update === 'function' ? produce(currentDoc, update) : update

    if (!get(suppressUndoCaptureAtom)) {
      captureUndoEntry(get, set, currentDoc, nextDoc)
    }

    set(rawDocAtom, nextDoc)
  }
)

export const dragSelectedLineIdsAtom = atom<string[]>([])

export const dragSelectionAnchorIdAtom = atom<string | null>(null)

/**
 * Tracks whether the command palette is open
 * The focused line (if any) will render it
 */
export const commandPaletteOpenAtom = atom<boolean>(false)
export const commandPaletteSearchAtom = atom(false)

export const goToLineOpenAtom = atom<boolean>(false)

export const showLineNumbersAtom = atom<boolean>(false)

export type TimerMode = 'stopwatch' | 'countdown' | 'manual'

/**
 * Request to open the timer row for a specific line with a specific mode.
 * TimerBadge watches this and opens when its lineIdx matches.
 */
export const timerRowRequestAtom = atom<{
  lineIdx: number
  mode: TimerMode
} | null>(null)

export const errorMessageAtom = atom<string | null>(null)

export const timerBusyAtom = atom(false)

export type GlobalTimerState = {
  noteTitle?: string
  baseTimeSeconds?: number
  isActive: boolean
  lineId: string | null
  lineContent: string | null
  /** Mode the running timer was started in; meaningless while idle. */
  mode: TimerMode
  timeMode: 'additive' | 'replacement'
  /** Elapsed milliseconds from completed run segments (grows on pause). */
  accumulatedMs: number
  /** Wall-clock start of the current run segment; null while paused/idle. */
  runningSince: number | null
  targetDuration: number
}

/** Serializable timer state; elapsed time derives from accumulatedMs + runningSince. */
export const globalTimerAtom = atom<GlobalTimerState>({
  isActive: false,
  lineId: null,
  lineContent: null,
  mode: 'stopwatch',
  timeMode: 'replacement',
  accumulatedMs: 0,
  runningSince: null,
  targetDuration: DEFAULT_COUNTDOWN_SECONDS,
})

export const allTagsAtom = atomWithQuery(
  () => ({
    queryKey: ['allTags'],
    queryFn: () => {
      return orpcClient.tags.allTags()
    },
    // every 5 minutes
    refetchInterval: 60 * 5 * 1000,
  }),
  () => queryClient
)

/** Update a document line through its store outside React. */
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

/** Read a document line and return a setter for modifying it. */
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

/** Resolve a stable line ID to its current line and index, or null if absent. */
export const findLineById = (
  doc: ZDoc,
  id: string | null
): { line: ZLine; lineIdx: number } | null => {
  if (id === null) return null
  const lineIdx = doc.children.findIndex((l) => l.id === id)
  if (lineIdx === -1) return null
  return { line: doc.children[lineIdx], lineIdx }
}
