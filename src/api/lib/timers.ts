import { ORPCError } from '@orpc/server'
import type { Kysely } from 'kysely'
import type { Database, DBTimer } from '@/db/types'
import type { Timer } from '@/docs/timer'
import { upsertNoteInTx } from '../routers/doc'

export const presentTimer = (row: DBTimer): Timer => ({
  id: row.id,
  noteTitle: row.note_title,
  lineId: row.line_id,
  lineContent: row.line_content,
  mode: row.mode,
  timeMode: row.time_mode,
  accumulatedMs: row.accumulated_ms,
  runningSince: row.running_since,
  targetDuration: row.target_duration,
  baseTimeSeconds: row.base_time_seconds,
  completedAt: row.completed_at,
  completionError: row.completion_error,
  revision: row.revision,
})

export type TimerAction = {
  id: string
  revision: number
  action: 'pause' | 'resume' | 'save' | 'discard' | 'complete' | 'retarget'
  target?: {
    noteTitle: string
    lineId: string
    timeMode: Timer['timeMode']
    expectedTimeSeconds: number | null
  }
}

const elapsed = (timer: DBTimer, now: number) =>
  timer.accumulated_ms +
  (timer.running_since === null ? 0 : Math.max(0, now - timer.running_since))

/** All completion paths lock and consume the same timer row. */
export const changeTimer = async (
  db: Kysely<Database>,
  input: TimerAction,
  now = Date.now()
): Promise<Timer | null> =>
  db.transaction().execute(async (tx) => {
    let timer = await tx
      .selectFrom('timers')
      .selectAll()
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (!timer) return null
    if (timer.revision !== input.revision)
      throw new ORPCError('CONFLICT', {
        message: 'Timer changed on another device. Refresh and try again.',
      })
    if (input.action === 'discard') {
      await tx.deleteFrom('timers').where('id', '=', timer.id).execute()
      return null
    }
    const due =
      timer.mode === 'countdown' &&
      timer.running_since !== null &&
      elapsed(timer, now) >= timer.target_duration * 1000
    if (input.action === 'complete' && !due) return presentTimer(timer)
    if (input.action === 'retarget') {
      if (timer.completed_at === null || !input.target)
        throw new ORPCError('BAD_REQUEST', {
          message: 'Only completed timers can be assigned to a line',
        })
      timer = {
        ...timer,
        note_title: input.target.noteTitle,
        line_id: input.target.lineId,
        time_mode: input.target.timeMode,
        base_time_seconds: input.target.expectedTimeSeconds,
      }
    } else if (input.action === 'pause' || input.action === 'resume') {
      if (timer.completed_at !== null)
        throw new ORPCError('BAD_REQUEST', {
          message: 'Completed timers cannot be resumed',
        })
      if (!due) {
        const updated = await tx
          .updateTable('timers')
          .set({
            accumulated_ms:
              input.action === 'pause'
                ? elapsed(timer, now)
                : timer.accumulated_ms,
            running_since:
              input.action === 'pause' ? null : (timer.running_since ?? now),
            revision: timer.revision + 1,
          })
          .where('id', '=', timer.id)
          .returningAll()
          .executeTakeFirstOrThrow()
        return presentTimer(updated)
      }
    }
    const duration =
      timer.mode === 'countdown'
        ? Math.min(elapsed(timer, now), timer.target_duration * 1000)
        : elapsed(timer, now)
    timer = {
      ...timer,
      accumulated_ms: duration,
      running_since: null,
      completed_at:
        timer.completed_at ??
        (due ? now - (elapsed(timer, now) - duration) : now),
      revision: timer.revision + 1,
    }
    const note = await tx
      .selectFrom('notes')
      .select('body')
      .where('title', '=', timer.note_title)
      .forUpdate()
      .executeTakeFirst()
    const line = note?.body.children.find((line) => line.id === timer.line_id)
    if (!line || !note) timer.completion_error = 'missing_line'
    else if (
      timer.time_mode === 'replacement' &&
      (line.datumTimeSeconds ?? null) !== timer.base_time_seconds
    )
      timer.completion_error = 'time_changed'
    else {
      const seconds = Math.floor(duration / 1000)
      line.datumTimeSeconds =
        timer.time_mode === 'additive'
          ? (line.datumTimeSeconds ?? 0) + seconds
          : seconds
      line.timeUpdated = new Date(now).toISOString()
      await upsertNoteInTx(tx, timer.note_title, note.body)
      await tx.deleteFrom('timers').where('id', '=', timer.id).execute()
      return null
    }
    const retained = await tx
      .updateTable('timers')
      .set(timer)
      .where('id', '=', timer.id)
      .returningAll()
      .executeTakeFirstOrThrow()
    return presentTimer(retained)
  })

export const completeDueTimers = async (db: Kysely<Database>) => {
  const timers = await db
    .selectFrom('timers')
    .selectAll()
    .where('mode', '=', 'countdown')
    .where('running_since', 'is not', null)
    .execute()
  for (const timer of timers) {
    if (elapsed(timer, Date.now()) < timer.target_duration * 1000) continue
    try {
      await changeTimer(db, {
        id: timer.id,
        revision: timer.revision,
        action: 'complete',
      })
    } catch (error) {
      if (!(error instanceof ORPCError && error.code === 'CONFLICT'))
        throw error
    }
  }
}
