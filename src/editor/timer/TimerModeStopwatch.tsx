import type { GlobalTimerState } from '../state'
import { isTimerPaused, timerElapsedSeconds } from './timer-controller'
import { TimerControls, TimerDisplay } from './TimerControls'
import { useTimerTick } from './useTimerTick'

export const TimerModeStopwatch = ({
  globalTimer,
  isRunningHere,
  isAnyTimerActive,
  onStart,
  onPause,
  onResume,
  onStop,
  onDiscard,
}: {
  globalTimer: GlobalTimerState
  /** This line's timer is running in stopwatch mode. */
  isRunningHere: boolean
  isAnyTimerActive: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDiscard: () => void
}) => {
  const isPaused = isRunningHere && isTimerPaused(globalTimer)
  useTimerTick(isRunningHere && !isPaused)

  return (
    <div className="space-y-6">
      <TimerDisplay
        seconds={isRunningHere ? timerElapsedSeconds(globalTimer) : 0}
        caption="Stopwatch Mode - counts up."
        isPaused={isPaused}
      />
      <TimerControls
        isRunning={isRunningHere}
        isPaused={isPaused}
        startDisabled={isAnyTimerActive}
        startLabel={isAnyTimerActive ? 'Timer Active' : 'Start'}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onDiscard={onDiscard}
      />
    </div>
  )
}
