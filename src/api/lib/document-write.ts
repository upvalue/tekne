import { ORPCError } from '@orpc/server'
import { sql, type Kysely } from 'kysely'
import type { Database } from '@/db'
import { zdoc, type ZDoc } from '@/docs/schema'
import { deriveNoteRows } from './docs'

/**
 * Upserts a note and rebuilds its derived data (note_data, note_lines,
 * parsed_body) inside an existing transaction. Increments the revision on
 * update so callers can detect concurrent modification via expectedRevision.
 * Returns the note's new revision.
 */
export const upsertNoteInTx = async (
  tx: Kysely<Database>,
  name: string,
  body: ZDoc,
  insertOnly = false
): Promise<number> => {
  body = zdoc.parse(body)
  const { parsedBody, noteData, noteLines } = deriveNoteRows(name, body)
  if (body.children.length) {
    const existing = await tx
      .selectFrom('note_lines')
      .select('line_id')
      .where(
        'line_id',
        'in',
        body.children.map((line) => line.id)
      )
      .where('note_title', '!=', name)
      .executeTakeFirst()
    if (existing)
      throw new ORPCError('CONFLICT', {
        message:
          'A line ID belongs to another document. Generate fresh IDs when copying lines.',
      })
  }

  const r = await tx
    .insertInto('notes')
    .values({
      title: name,
      body,
      revision: 0,
      parsed_body: sql`${JSON.stringify(parsedBody)}::jsonb`,
      updatedAt: sql`now()`,
    })
    .onConflict((oc) =>
      insertOnly
        ? oc.column('title').doNothing()
        : oc.column('title').doUpdateSet({
            body,
            parsed_body: sql`${JSON.stringify(parsedBody)}::jsonb`,
            updatedAt: sql`now()`,
            revision: sql`notes.revision + 1`,
          })
    )
    .returning('revision')
    .executeTakeFirst()

  if (!r)
    throw new ORPCError('CONFLICT', {
      message: `Document with name "${name}" already exists`,
    })

  await tx.deleteFrom('note_data').where('note_title', '=', name).execute()

  if (noteData.length > 0) {
    await tx.insertInto('note_data').values(noteData).execute()
  }

  await tx.deleteFrom('note_lines').where('note_title', '=', name).execute()

  if (noteLines.length > 0) {
    await tx.insertInto('note_lines').values(noteLines).execute()
  }

  return r.revision
}
