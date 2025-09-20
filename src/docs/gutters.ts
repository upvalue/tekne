import type { ZLine } from './schema'

// Time difference threshold in minutes for showing timestamps
export const TIME_DIFF_THRESHOLD_MINUTES = 20

// NOTE-REDUCER: This is a document reducer that could be centralized

export type GutterTimestamp = {
  defaultString: string | null
  fullString: string
}

/**
 * Generates an array of gutter timestamp strings for display.
 * Returns null for lines that don't meet display criteria, or a formatted timestamp string.
 *
 * Rules:
 * - Show date + time when date differs from most recently seen line
 * - Show time only when time differs by more than threshold from most recently seen line
 * - Return null when no timestamp should be shown
 */
export function generateGutterTimestamps(lines: ZLine[]): GutterTimestamp[] {
  const result: GutterTimestamp[] = []
  let lastShownDate: Date | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineDate = new Date(line.timeUpdated)

    let shouldShow = false
    let showFullDate = false

    if (lastShownDate === null) {
      // First line always shows
      shouldShow = true
      showFullDate = true
    } else {
      // Check if date differs
      const lastDateOnly = new Date(
        lastShownDate.getFullYear(),
        lastShownDate.getMonth(),
        lastShownDate.getDate()
      )
      const currentDateOnly = new Date(
        lineDate.getFullYear(),
        lineDate.getMonth(),
        lineDate.getDate()
      )

      if (lastDateOnly.getTime() !== currentDateOnly.getTime()) {
        shouldShow = true
        showFullDate = true
      } else {
        // Same date, check time difference
        const timeDiffMs = Math.abs(
          lineDate.getTime() - lastShownDate.getTime()
        )
        const timeDiffMinutes = timeDiffMs / (1000 * 60)

        if (timeDiffMinutes >= TIME_DIFF_THRESHOLD_MINUTES) {
          shouldShow = true
          showFullDate = false
        }
      }
    }

    // Generate full date and time str

    const fullDateStr = lineDate.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    })
    const fullTimeStr = lineDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    const fullDateAndTimeStr = `${fullDateStr} ${fullTimeStr}`

    if (shouldShow) {
      if (showFullDate) {
        const dateStr = lineDate.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
        })
        // Format as "M/d h:mm AM/PM"
        const timeStr = lineDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        result.push({
          defaultString: `${dateStr} ${timeStr}`,
          fullString: fullDateAndTimeStr,
        })
      } else {
        // Format as "h:mm AM/PM"
        const timeStr = lineDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        result.push({
          defaultString: timeStr,
          fullString: fullDateAndTimeStr,
        })
      }
      lastShownDate = lineDate
    } else {
      result.push({
        defaultString: null,
        fullString: fullDateAndTimeStr,
      })
    }
  }

  return result
}
