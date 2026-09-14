import { Button } from '@/components/vendor/Button'
import { Pause, Play, Square } from 'lucide-react'
import { formatTimeDisplay } from '@/lib/time'

/** The big mono time readout shared by the stopwatch and countdown modes. */
export const TimerDisplay = ({
  seconds,
  caption,
  isPaused,
}: {
  seconds: number
  caption: string
  isPaused: boolean
}) => (
  <div className="text-center">
    <div className="text-4xl font-mono mb-2">{formatTimeDisplay(seconds)}</div>
    <div className="text-sm text-gray-400">
      {isPaused ? <span className="text-amber-400">Paused</span> : caption}
    </div>
  </div>
)

/**
 * The one button row for every running-timer mode, so stopwatch and
 * countdown present identical verbs in identical places: Start when idle;
 * Pause/Resume and Stop & Save while running; Discard always last.
 */
export const TimerControls = ({
  isRunning,
  isPaused,
  startDisabled,
  startLabel = 'Start',
  startIsSubmit = false,
  onStart,
  onPause,
  onResume,
  onStop,
  onDiscard,
}: {
  isRunning: boolean
  isPaused: boolean
  startDisabled: boolean
  startLabel?: string
  /** Render Start as the submit button of an enclosing form. */
  startIsSubmit?: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDiscard: () => void
}) => (
  <div className="flex flex-wrap gap-2 justify-center [&>button]:min-h-11 [&>button]:grow">
    {!isRunning ? (
      <Button
        type={startIsSubmit ? 'submit' : 'button'}
        onClick={startIsSubmit ? undefined : onStart}
        className="flex items-center gap-2"
        disabled={startDisabled}
      >
        <Play className="w-4 h-4" />
        {startLabel}
      </Button>
    ) : (
      <>
        <Button
          type="button"
          onClick={isPaused ? onResume : onPause}
          className="flex items-center gap-2"
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          )}
        </Button>
        <Button
          type="button"
          onClick={onStop}
          className="flex items-center gap-2"
        >
          <Square className="w-4 h-4" />
          Stop & Save
        </Button>
      </>
    )}
    <Button type="button" onClick={onDiscard} outline disabled={!isRunning}>
      Discard
    </Button>
  </div>
)
