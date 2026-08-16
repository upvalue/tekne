import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import { cancelUncheckedTasksBefore } from '@/docs/task-cancel'
import type { Database } from '@/db'
import { t } from '../init'
import { upsertNoteInTx } from './doc'

const cutoffSchema = z.iso.datetime()

const selectedDocumentsSchema = z
  .array(
    z.object({
      title: z.string().min(1),
      expectedRevision: z.number().int().nonnegative(),
    })
  )
  .min(1)
  .refine(
    (documents) =>
      new Set(documents.map((document) => document.title)).size ===
      documents.length,
    { message: 'Each document may only be selected once' }
  )

const proposeStaleTaskCancellation = async (
  db: Kysely<Database>,
  cutoff: Date
) => {
  // note_lines narrows this to documents with an old line. Task status still
  // comes from the document body because note_data misses untagged tasks.
  const candidates = await db
    .selectFrom('note_lines')
    .select('note_title')
    .where('time_created', '<', cutoff)
    .where('note_title', 'not like', '$%')
    .distinct()
    .execute()

  if (candidates.length === 0) {
    return { documents: [], totalChanges: 0 }
  }

  const notes = await db
    .selectFrom('notes')
    .select(['title', 'body', 'revision'])
    .where(
      'title',
      'in',
      candidates.map((candidate) => candidate.note_title)
    )
    .orderBy('title')
    .execute()

  const documents = notes.flatMap((note) => {
    const result = cancelUncheckedTasksBefore(note.body, cutoff)
    if (result.changes.length === 0) return []
    return [
      {
        title: note.title,
        revision: note.revision,
        isTemplate: note.title.startsWith('$'),
        changes: result.changes,
      },
    ]
  })

  return {
    documents,
    totalChanges: documents.reduce(
      (total, document) => total + document.changes.length,
      0
    ),
  }
}

export const tasksRouter = t.router({
  cancelStalePropose: t.procedure
    .input(z.object({ cutoff: cutoffSchema }))
    .mutation(async ({ input, ctx: { db } }) =>
      proposeStaleTaskCancellation(db, new Date(input.cutoff))
    ),

  cancelStaleExecute: t.procedure
    .input(
      z.object({
        cutoff: cutoffSchema,
        documents: selectedDocumentsSchema,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const cutoff = new Date(input.cutoff)

      return db.transaction().execute(async (tx) => {
        let tasksUpdated = 0
        let documentsUpdated = 0

        for (const selected of input.documents) {
          const note = await tx
            .selectFrom('notes')
            .select(['body', 'revision'])
            .where('title', '=', selected.title)
            .forUpdate()
            .executeTakeFirst()

          if (!note) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Document "${selected.title}" no longer exists`,
            })
          }
          if (note.revision !== selected.expectedRevision) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Document "${selected.title}" changed after the preview`,
            })
          }

          const result = cancelUncheckedTasksBefore(note.body, cutoff)
          if (result.changes.length === 0) continue

          await upsertNoteInTx(tx, selected.title, result.doc)
          tasksUpdated += result.changes.length
          documentsUpdated += 1
        }

        return { success: true, tasksUpdated, documentsUpdated }
      })
    }),
})
