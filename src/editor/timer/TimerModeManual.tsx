import { Button } from '@/components/vendor/Button'
import { Input } from '@/components/vendor/Input'
import type { GlobalTimerState } from '../state'
import { parseTime } from './parse-time'

export const TimerModeManual = ({
  timeMode,
  timeInput,
  onTimeInputChange,
  onSubmit,
}: {
  timeMode: GlobalTimerState['timeMode']
  timeInput: string
  onTimeInputChange: (value: string) => void
  /** Called with the parsed duration in seconds when the form submits. */
  onSubmit: (durationSeconds: number) => void
}) => {
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        const duration = parseTime(timeInput)
        if (duration !== null) {
          onSubmit(duration)
        }
      }}
    >
      <div className="text-center">
        <div className="text-2xl font-mono mb-2 text-gray-400">
          Manual Entry
        </div>
        <div className="text-sm text-gray-400">
          Enter time directly without running a timer. <br />
          {timeMode === 'additive'
            ? 'Adds to existing time.'
            : 'Replaces existing time.'}
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Enter Time:</label>
          <Input
            autoFocus
            type="text"
            value={timeInput}
            onChange={(e) => onTimeInputChange(e.target.value)}
            placeholder="e.g., 2h 30m, 45m, 1h"
          />
          {parseTime(timeInput) === null && timeInput && (
            <div className="text-red-400 text-sm">
              Unable to parse duration. Try: 2h 30m, 45m, etc.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={parseTime(timeInput) === null}
            color="sky"
            className="flex-1"
          >
            {timeMode === 'additive' ? 'Add Time' : 'Set Time'}
          </Button>
        </div>
      </div>
    </form>
  )
}
