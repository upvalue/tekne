import { ORPCError } from '@orpc/server'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import type { Database } from '@/db'
import { applyDocumentEdit } from '@/docs/document-edit'
import { inputs } from '../inputs'
import { outputs } from '../outputs'
import { upsertNoteInTx } from './document-write'

export async function editDocument(
  db: Kysely<Database>,
  input: z.infer<typeof inputs.doc.editDoc>
) {
  return db.transaction().execute(async (tx) => {
    const current = await tx
      .selectFrom('notes')
      .select(['body', 'revision'])
      .where('title', '=', input.name)
      .forUpdate()
      .executeTakeFirst()
    if (!current)
      throw new ORPCError('NOT_FOUND', { message: 'Document no longer exists' })
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        JSON.stringify({
          expectedRevision: input.expectedRevision,
          operations: input.operations,
        })
      )
    )
    const requestHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    const receipt = await tx
      .selectFrom('document_patch_receipts')
      .selectAll()
      .where('request_id', '=', input.requestId)
      .executeTakeFirst()
    if (receipt) {
      if (
        receipt.kind !== 'edit' ||
        receipt.note_title !== input.name ||
        receipt.request_hash !== requestHash
      ) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Request ID was already used for a different operation',
        })
      }
      return outputs.doc.editDoc.parse(receipt.result)
    }
    if (current.revision !== input.expectedRevision) {
      return {
        status: 'conflict' as const,
        serverDoc: current.body,
        serverRevision: current.revision,
      }
    }
    let edited: ReturnType<typeof applyDocumentEdit>
    try {
      edited = applyDocumentEdit(current.body, input.operations)
    } catch (error) {
      throw new ORPCError('BAD_REQUEST', {
        message: error instanceof Error ? error.message : 'Invalid edit',
      })
    }
    const revision = await upsertNoteInTx(tx, input.name, edited.doc)
    const result = {
      status: 'ok' as const,
      revision,
      insertedLines: edited.insertedLines,
    }
    const inserted = await tx
      .insertInto('document_patch_receipts')
      .values({
        request_id: input.requestId,
        note_title: input.name,
        request_hash: requestHash,
        revision,
        kind: 'edit',
        result,
      })
      .onConflict((oc) => oc.doNothing())
      .returning('request_id')
      .executeTakeFirst()
    if (!inserted) {
      // A competing request for a different document claimed this ID. Roll back the write.
      throw new ORPCError('BAD_REQUEST', {
        message: 'Request ID was already used for a different operation',
      })
    }
    return result
  })
}
