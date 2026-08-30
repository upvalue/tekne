import { Input } from '@/components/vendor/Input'
import type { GlobalTimerState } from '../state'
import { isTimerPaused, timerRemainingSeconds } from './timer-controller'
import { parseTime } from './parse-time'
import { TimerControls, TimerDisplay } from './TimerControls'
import { useTimerTick } from './useTimerTick'

export const TimerModeCountdown = ({
  globalTimer,
  isRunningHere,
  isAnyTimerActive,
  countdownInput,
  onCountdownInputChange,
  onStart,
  onPause,
  onResume,
  onStop,
  onDiscard,
}: {
  globalTimer: GlobalTimerState
  /** This line's timer is running in countdown mode. */
  isRunningHere: boolean
  isAnyTimerActive: boolean
  countdownInput: string
  onCountdownInputChange: (value: string) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDiscard: () => void
}) => {
  const isPaused = isRunningHere && isTimerPaused(globalTimer)
  useTimerTick(isRunningHere && !isPaused)

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        onStart()
      }}
    >
      <TimerDisplay
        seconds={
          isRunningHere
            ? timerRemainingSeconds(globalTimer)
            : (parseTime(countdownInput) ?? globalTimer.targetDuration)
        }
        caption="Countdown Mode - Counts down to zero."
        isPaused={isPaused}
      />
      {!isRunningHere && (
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Set Duration:</label>
          <Input
            autoFocus
            type="text"
            value={countdownInput}
            onChange={(e) => onCountdownInputChange(e.target.value)}
            placeholder="e.g., 25m, 1h 30m"
            className="w-full"
            disabled={isAnyTimerActive}
          />
          {parseTime(countdownInput) === null && countdownInput && (
            <div className="text-red-400 text-sm">
              Unable to parse duration. Try: 25m, 1h 30m, etc.
            </div>
          )}
        </div>
      )}
      <TimerControls
        isRunning={isRunningHere}
        isPaused={isPaused}
        startDisabled={isAnyTimerActive || parseTime(countdownInput) === null}
        startLabel={isAnyTimerActive ? 'Timer Active' : 'Start'}
        startIsSubmit
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onDiscard={onDiscard}
      />
    </form>
  )
}
