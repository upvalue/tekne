import { useAtomValue, useStore } from 'jotai'
import { globalTimerAtom } from '../state'
import { useTimerTick } from './useTimerTick'
import {
  isTimerPaused,
  timerElapsedSeconds,
  timerRemainingSeconds,
} from './timer-controller'
import { formatTimeDisplay } from '@/lib/time'
import { navigateToDocument } from '@/lib/app-events'
import { docAtom, requestFocusLineAtom } from '../state'

export const RunningTimerPill = () => {
  const timer = useAtomValue(globalTimerAtom)
  const store = useStore()
  useTimerTick(timer.isActive && !isTimerPaused(timer))
  if (!timer.isActive) return null
  const seconds =
    timer.mode === 'countdown'
      ? timerRemainingSeconds(timer)
      : (timer.baseTimeSeconds ?? 0) + timerElapsedSeconds(timer)
  return (
    <button
      className="rounded bg-accent-tint px-2 py-0.5 text-xs text-accent tabular-nums max-w-64 truncate"
      aria-label="Jump to running timer"
      onClick={() => {
        const index = store
          .get(docAtom)
          .children.findIndex((line) => line.id === timer.lineId)
        if (index >= 0) {
          store.set(docAtom, (draft) => {
            for (let i = 0; i < index; i++) delete draft.children[i].collapsed
          })
          store.set(requestFocusLineAtom, { lineIdx: index, pos: 0 })
        } else if (timer.noteTitle) {
          navigateToDocument(timer.noteTitle, timer.lineId ?? undefined)
        }
      }}
    >
      {isTimerPaused(timer) ? 'Ⅱ' : '●'} {formatTimeDisplay(seconds)}{' '}
      <span className="font-sans hidden xl:inline">{timer.lineContent}</span>
    </button>
  )
}
