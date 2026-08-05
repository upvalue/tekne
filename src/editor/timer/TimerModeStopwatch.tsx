import { Button } from '@/components/vendor/Button'
import { Play, Square } from 'lucide-react'
import { formatTimeDisplay } from '@/lib/time'
import type { GlobalTimerState } from '../state'
import { timerElapsedSeconds } from './timer-controller'
import { useTimerTick } from './useTimerTick'

export const TimerModeStopwatch = ({
  globalTimer,
  isThisTimerActive,
  isAnyTimerActive,
  onStart,
  onStop,
  onReset,
}: {
  globalTimer: GlobalTimerState
  isThisTimerActive: boolean
  isAnyTimerActive: boolean
  onStart: () => void
  onStop: () => void
  onReset: () => void
}) => {
  useTimerTick(isThisTimerActive)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl font-mono mb-2">
          {formatTimeDisplay(
            isThisTimerActive ? timerElapsedSeconds(globalTimer) : 0
          )}
        </div>
        <div className="text-sm text-gray-400">Stopwatch Mode - counts up.</div>
      </div>
      <div className="flex gap-2 justify-center">
        {!isThisTimerActive ? (
          <Button
            onClick={onStart}
            className="flex items-center gap-2"
            disabled={isAnyTimerActive}
          >
            <Play className="w-4 h-4" />
            {isAnyTimerActive ? 'Timer Active Elsewhere' : 'Start'}
          </Button>
        ) : (
          <Button onClick={onStop} className="flex items-center gap-2">
            <Square className="w-4 h-4" />
            Stop & Save
          </Button>
        )}
        <Button onClick={onReset} outline disabled={!isThisTimerActive}>
          Reset
        </Button>
      </div>
    </div>
  )
}
