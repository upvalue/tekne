import { formatTimeDisplay, renderTime } from '@/lib/time'
import type { GlobalTimerState } from './state'
import {
  isTimerPaused,
  timerElapsedSeconds,
  timerRemainingSeconds,
} from './timer/timer-controller'
import { useTimerTick } from './timer/useTimerTick'

interface TimerInfoProps {
  baseTime: number
  globalTimer: Pick<
    GlobalTimerState,
    | 'accumulatedMs'
    | 'runningSince'
    | 'targetDuration'
    | 'mode'
    | 'timeMode'
    | 'isActive'
  >
  isThisTimer: boolean
  className?: string
}

/**
 * Shared component for displaying timer information with additive mode support.
 * Shows "baseTime + currentTime" for additive mode, or just current/base time for replacement mode.
 */
export const TimerInfo = ({
  baseTime,
  globalTimer,
  isThisTimer,
  className = '',
}: TimerInfoProps) => {
  // Re-render each second while displaying a running (unpaused) timer
  useTimerTick(
    isThisTimer && globalTimer.isActive && !isTimerPaused(globalTimer)
  )

  // If this timer is not active, just show the base time
  if (!isThisTimer) {
    return baseTime > 0 ? (
      <span className={className}>{renderTime(baseTime)}</span>
    ) : null
  }

  // Timer is active - current time derives from the controller's math, so
  // pause is honored here for free
  const currentSeconds =
    globalTimer.mode === 'countdown'
      ? timerRemainingSeconds(globalTimer)
      : timerElapsedSeconds(globalTimer)

  const currentTime = formatTimeDisplay(currentSeconds)

  // For replacement mode, just show current timer
  if (globalTimer.timeMode === 'replacement') {
    return <span className={className}>{currentTime}</span>
  }

  // For additive mode, show base + current if there's base time
  if (baseTime > 0) {
    return (
      <span className={className}>
        {renderTime(baseTime)} + {currentTime}
      </span>
    )
  }

  // Additive mode but no base time - just show current
  return <span className={className}>{currentTime}</span>
}
