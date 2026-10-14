import type { ZLine } from './schema'

export const TIME_DIFF_THRESHOLD_MINUTES = 20

export type GutterTimestamp = {
  defaultString: string | null
  fullString: string
}

/**
 * Show the first timestamp, date changes, and gaps at least TIME_DIFF_THRESHOLD_MINUTES
 * from the last shown timestamp. Hidden entries keep fullString for tooltips.
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
      shouldShow = true
      showFullDate = true
    } else {
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
