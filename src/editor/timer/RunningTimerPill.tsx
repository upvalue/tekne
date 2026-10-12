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
  const doc = useAtomValue(docAtom)
  useTimerTick(timer.isActive && !isTimerPaused(timer))
  if (!timer.isActive) return null
  const elapsed = timerElapsedSeconds(timer)
  const remaining = timerRemainingSeconds(timer)
  const additive = timer.timeMode === 'additive'
  const recorded =
    doc.children.find((line) => line.id === timer.lineId)?.datumTimeSeconds ??
    timer.baseTimeSeconds ??
    0
  const display = additive
    ? `${formatTimeDisplay(recorded)} + ${formatTimeDisplay(elapsed)}`
    : formatTimeDisplay(timer.mode === 'countdown' ? remaining : elapsed)
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
      {isTimerPaused(timer) ? 'Ⅱ' : '●'} {display}
      {timer.mode === 'countdown' && (
        <span>
          {additive ? ` · ${formatTimeDisplay(remaining)} left` : ' left'}
        </span>
      )}{' '}
      <span className="font-sans hidden xl:inline">{timer.lineContent}</span>
    </button>
  )
}
