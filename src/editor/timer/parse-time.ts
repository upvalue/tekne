import parseDuration from 'parse-duration'

/** Parse a human duration ("25m", "1h 30m") to seconds, or null. */
export const parseTime = (time: string): number | null =>
  parseDuration(time, 's')
