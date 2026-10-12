import { useAtomValue, useStore } from 'jotai'
import { globalTimerAtom } from '../state'
import { useTimerTick } from './useTimerTick'
import {
  isTimerPaused,
  timerElapsedSeconds,
  timerRemainingSeconds,
} from './timer-controller'
import { formatTimeDisplay } from '@/lib/time'
import { appPath } from '@/lib/app-path'
import { docAtom, requestFocusLineAtom } from '../state'

export const RunningTimerPill = () => {
  const timer = useAtomValue(globalTimerAtom)
  const store = useStore()
  useTimerTick(timer.isActive && !isTimerPaused(timer))
  if (!timer.isActive) return null
  const seconds =
    timer.mode === 'countdown'
      ? timerRemainingSeconds(timer)
      : timerElapsedSeconds(timer)
  return (
    <button
      className="rounded-full bg-accent-tint px-3 py-1.5 text-xs text-accent font-mono max-w-64 truncate"
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
          window.location.href = appPath(
            `/n/${encodeURIComponent(timer.noteTitle)}#line-${timer.lineId}`
          )
        }
      }}
    >
      {isTimerPaused(timer) ? 'Ⅱ' : '●'} {formatTimeDisplay(seconds)}{' '}
      <span className="font-sans hidden xl:inline">{timer.lineContent}</span>
    </button>
  )
}
