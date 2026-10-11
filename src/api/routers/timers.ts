import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { sql } from 'kysely'
import { proc } from '../init'
import { timerSchema, timerListSchema } from '@/docs/timer'
import { LINE_ID_PATTERN } from '@/docs/line-identity'
import { changeTimer, presentTimer } from '../lib/timers'

export const timersRouter = {
  list: proc
    .route({
      method: 'POST',
      path: '/timers/list',
      tags: ['timers'],
      summary: 'List timers',
      description:
        'Read running, paused, and completed timers awaiting resolution. Does not advance or save timers.',
    })
    .input(z.void())
    .output(timerListSchema)
    .handler(async ({ context: { db } }) => ({
      timers: (
        await db.selectFrom('timers').selectAll().orderBy('id').execute()
      ).map(presentTimer),
      serverNow: Date.now(),
    })),
  status: proc
    .route({
      method: 'GET',
      path: '/timers/status',
      tags: ['timers'],
      summary: 'Timer status',
      description:
        'Read timers with their document title and up to five surrounding lines for external displays. Does not mutate documents or timers.',
    })
    .input(z.object({}).optional())
    .output(
      z.object({
        timers: z.array(timerSchema.extend({ context: z.string() })),
        serverNow: z.number(),
      })
    )
    .handler(async ({ context: { db } }) => {
      const rows = await db
        .selectFrom('timers')
        .leftJoin('notes', 'notes.title', 'timers.note_title')
        .selectAll('timers')
        .select('notes.body as document')
        .orderBy(sql`timers.running_since desc nulls last`)
        .orderBy('timers.id')
        .execute()
      return {
        serverNow: Date.now(),
        timers: rows.map((row) => {
          const index =
            row.document?.children.findIndex(
              (line) => line.id === row.line_id
            ) ?? -1
          const context =
            index < 0 || !row.document
              ? row.line_content
              : row.document.children
                  .slice(Math.max(0, index - 5), index + 6)
                  .map(
                    (line) =>
                      `${'  '.repeat(Math.max(0, Math.floor(line.indent)))}${line.mdContent}`
                  )
                  .join('\n')
          return {
            ...presentTimer(row),
            lineContent:
              index >= 0
                ? row.document!.children[index].mdContent
                : row.line_content,
            context: `${row.note_title}\n${context}`,
          }
        }),
      }
    }),
  start: proc
    .route({
      method: 'POST',
      path: '/timers/start',
      tags: ['timers'],
      summary: 'Start timer',
      description:
        'Start a timer on a saved line ID. One running or paused timer may exist across the app. Reuse id when retrying a start.',
    })
    .input(
      z.object({
        id: z.uuid(),
        noteTitle: z.string(),
        lineId: z.string().regex(LINE_ID_PATTERN),
        mode: z.enum(['stopwatch', 'countdown']),
        timeMode: z.enum(['additive', 'replacement']),
        targetDuration: z.number().int().positive().max(31536000),
      })
    )
    .output(timerSchema)
    .handler(async ({ input, context: { db } }) =>
      db.transaction().execute(async (tx) => {
        const inserted = await tx
          .insertInto('timers')
          .values({
            id: input.id,
            note_title: input.noteTitle,
            line_id: input.lineId,
            line_content: '',
            mode: input.mode,
            time_mode: input.timeMode,
            accumulated_ms: 0,
            running_since: Date.now(),
            target_duration: input.targetDuration,
            base_time_seconds: null,
            completed_at: null,
            completion_error: null,
            revision: 0,
          })
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .executeTakeFirst()
        if (!inserted) {
          const existing = await tx
            .selectFrom('timers')
            .selectAll()
            .where('id', '=', input.id)
            .executeTakeFirst()
          if (
            existing &&
            existing.note_title === input.noteTitle &&
            existing.line_id === input.lineId
          )
            return presentTimer(existing)
          throw new ORPCError('CONFLICT', {
            message: 'A timer is already active. Manage it in Tools → Timers.',
          })
        }
        const note = await tx
          .selectFrom('notes')
          .select('body')
          .where('title', '=', input.noteTitle)
          .forUpdate()
          .executeTakeFirst()
        const line = note?.body.children.find(
          (line) => line.id === input.lineId
        )
        if (!line)
          throw new ORPCError('NOT_FOUND', {
            message: 'Save the line before starting its timer',
          })
        return presentTimer(
          await tx
            .updateTable('timers')
            .set({
              line_content: line.mdContent,
              base_time_seconds: line.datumTimeSeconds ?? null,
            })
            .where('id', '=', input.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        )
      })
    ),
  change: proc
    .route({
      method: 'POST',
      path: '/timers/change',
      tags: ['timers'],
      summary: 'Change timer',
      description:
        'Pause, resume, save, discard, or resolve a timer with its current revision. Completion writes only the attached line time. Missing lines and replacement conflicts retain frozen elapsed time. complete saves only when a countdown is due on the server.',
    })
    .input(
      z.object({
        id: z.string(),
        revision: z.number().int().nonnegative(),
        action: z.enum([
          'pause',
          'resume',
          'save',
          'discard',
          'complete',
          'retarget',
        ]),
        target: z
          .object({
            noteTitle: z.string(),
            lineId: z.string().regex(LINE_ID_PATTERN),
            timeMode: z.enum(['additive', 'replacement']),
            expectedTimeSeconds: z.number().nullable(),
          })
          .optional(),
      })
    )
    .output(timerSchema.nullable())
    .handler(({ input, context: { db } }) => changeTimer(db, input)),
}
