import { Button } from '@/components/vendor/Button'
import { Input } from '@/components/vendor/Input'
import { PlayIcon, StopIcon } from '@heroicons/react/16/solid'
import { formatTimeDisplay } from '@/lib/time'
import type { GlobalTimerState } from '../state'
import { timerRemainingSeconds } from './timer-controller'
import { parseTime } from './parse-time'
import { useTimerTick } from './useTimerTick'

export const TimerModeCountdown = ({
  globalTimer,
  isThisTimerActive,
  isAnyTimerActive,
  countdownInput,
  onCountdownInputChange,
  onStart,
  onStop,
  onReset,
}: {
  globalTimer: GlobalTimerState
  isThisTimerActive: boolean
  isAnyTimerActive: boolean
  countdownInput: string
  onCountdownInputChange: (value: string) => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
}) => {
  useTimerTick(isThisTimerActive)

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        onStart()
      }}
    >
      <div className="text-center">
        <div className="text-4xl font-mono mb-2">
          {formatTimeDisplay(
            isThisTimerActive
              ? timerRemainingSeconds(globalTimer)
              : parseTime(countdownInput) || globalTimer.targetDuration
          )}
        </div>
        <div className="text-sm text-gray-400">
          Countdown Mode - Counts down to zero.
        </div>
      </div>
      {!isThisTimerActive && (
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
      <div className="flex gap-2 justify-center">
        {!isThisTimerActive ? (
          <Button
            type="submit"
            className="flex items-center gap-2"
            disabled={isAnyTimerActive || parseTime(countdownInput) === null}
          >
            <PlayIcon className="w-4 h-4" />
            {isAnyTimerActive ? 'Timer Active Elsewhere' : 'Start'}
          </Button>
        ) : (
          <Button onClick={onStop} className="flex items-center gap-2">
            <StopIcon className="w-4 h-4" />
            Stop
          </Button>
        )}
        <Button
          type="button"
          onClick={onReset}
          outline
          disabled={!isThisTimerActive}
        >
          Reset
        </Button>
      </div>
    </form>
  )
}
