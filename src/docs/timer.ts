import { z } from 'zod'

export const timerSchema = z.object({
  id: z.string(),
  noteTitle: z.string(),
  lineId: z.string().nullable(),
  lineContent: z.string(),
  mode: z.enum(['stopwatch', 'countdown']),
  timeMode: z.enum(['additive', 'replacement']),
  accumulatedMs: z.number(),
  runningSince: z.number().nullable(),
  targetDuration: z.number(),
  baseTimeSeconds: z.number().nullable(),
  completedAt: z.number().nullable(),
  completionError: z.enum(['missing_line', 'time_changed']).nullable(),
  revision: z.number(),
})
export type Timer = z.infer<typeof timerSchema>
export const timerListSchema = z.object({
  timers: z.array(timerSchema),
  serverNow: z.number(),
})

export const elapsedMilliseconds = (
  timer: Pick<Timer, 'accumulatedMs' | 'runningSince'>,
  now = Date.now()
) =>
  timer.accumulatedMs +
  (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince))
