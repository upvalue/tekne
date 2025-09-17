import type { ZLine } from './schema'

// Time difference threshold in minutes for showing timestamps
export const TIME_DIFF_THRESHOLD_MINUTES = 20

// NOTE-REDUCER: This is a document reducer that could be centralized

/**
 * Generates an array of gutter timestamp strings for display.
 * Returns null for lines that don't meet display criteria, or a formatted timestamp string.
 *
 * Rules:
 * - Show date + time when date differs from most recently seen line
 * - Show time only when time differs by more than threshold from most recently seen line
 * - Return null when no timestamp should be shown
 */
export function generateGutterTimestamps(lines: ZLine[]): (string | null)[] {
  const result: (string | null)[] = []
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

    if (shouldShow) {
      if (showFullDate) {
        // Format as "M/d h:mm AM/PM"
        const dateStr = lineDate.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
        })
        const timeStr = lineDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        result.push(`${dateStr} ${timeStr}`)
      } else {
        // Format as "h:mm AM/PM"
        const timeStr = lineDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        result.push(timeStr)
      }
      lastShownDate = lineDate
    } else {
      result.push(null)
    }
  }

  return result
}
