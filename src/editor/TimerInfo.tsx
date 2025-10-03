import { formatTimeDisplay, renderTime } from '@/lib/time'

interface TimerInfoProps {
  baseTime: number
  globalTimer: {
    startTime: number | null
    targetDuration: number
    mode: 'stopwatch' | 'countdown' | 'manual'
    timeMode: 'additive' | 'replacement'
    isActive: boolean
  }
  isThisTimer: boolean
  format?: 'compact' | 'full'
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
  format = 'compact',
  className = ''
}: TimerInfoProps) => {
  // If this timer is not active, just show the base time
  if (!isThisTimer) {
    return baseTime > 0 ? (
      <span className={className}>
        {renderTime(baseTime)}
      </span>
    ) : null
  }

  // Timer is active - calculate current time from startTime
  let currentSeconds = 0
  if (globalTimer.startTime) {
    const elapsed = Math.floor((Date.now() - globalTimer.startTime) / 1000)
    if (globalTimer.mode === 'stopwatch') {
      currentSeconds = elapsed
    } else if (globalTimer.mode === 'countdown') {
      currentSeconds = Math.max(0, globalTimer.targetDuration - elapsed)
    }
  }

  const currentTime = formatTimeDisplay(currentSeconds)

  // For replacement mode, just show current timer
  if (globalTimer.timeMode === 'replacement') {
    return (
      <span className={className}>
        {currentTime}
      </span>
    )
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
  return (
    <span className={className}>
      {currentTime}
    </span>
  )
}