import { outputs } from '../outputs'
import z from 'zod'
import { lineMake, zdoc, type ZDoc, docMake } from '@/docs/schema'
import { proc, storedDocumentProc } from '../init'
import type { Database } from '@/db'
import { sql, type Kysely } from 'kysely'
import { documentNameSchema } from '@/docs/validation'
import { makeTutorial } from '@/docs/tutorial'
import {
  docMigrator,
  migrateDocWithReport,
  validateDocumentWithMigrationCheck,
} from '@/docs/doc-migrator'
import { deriveNoteRows, recomputeAllDocumentData } from '@/api/lib/docs'
import { escapeLike } from '@/api/lib/search-operators'
import { applyTemplateDirectives } from '@/docs/template-directives'
import { produce } from 'immer'
import { TEKNE_MD_PARSER, visitMdTree } from '@/docs/parser'
import type { SyntaxNode } from '@lezer/common'
import MagicString from 'magic-string'
import { ORPCError } from '@orpc/server'

/**
 * Upserts a note and rebuilds its derived data (note_data, note_lines,
 * parsed_body) inside an existing transaction. Increments the revision on
 * update so callers can detect concurrent modification via expectedRevision.
 * Returns the note's new revision.
 */
export const upsertNoteInTx = async (
  tx: Kysely<Database>,
  name: string,
  body: ZDoc
): Promise<number> => {
  const { parsedBody, noteData, noteLines } = deriveNoteRows(name, body)

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
      oc.column('title').doUpdateSet({
        body,
        parsed_body: sql`${JSON.stringify(parsedBody)}::jsonb`,
        updatedAt: sql`now()`,
        revision: sql`notes.revision + 1`,
      })
    )
    .returning('revision')
    .executeTakeFirstOrThrow()

  // Drop all data by note title
  await tx.deleteFrom('note_data').where('note_title', '=', name).execute()

  if (noteData.length > 0) {
    await tx.insertInto('note_data').values(noteData).execute()
  }

  // Populate note_lines for text search
  await tx.deleteFrom('note_lines').where('note_title', '=', name).execute()

  if (noteLines.length > 0) {
    await tx.insertInto('note_lines').values(noteLines).execute()
  }

  return r.revision
}

const upsertNote = async (db: Kysely<Database>, name: string, body: ZDoc) => {
  return await db.transaction().execute((tx) => upsertNoteInTx(tx, name, body))
}

const docExists = async (
  db: Kysely<Database>,
  name: string
): Promise<boolean> => {
  const row = await db
    .selectFrom('notes')
    .select(['title'])
    .where('title', '=', name)
    .executeTakeFirst()
  return row !== undefined
}

const loadNote = async (
  db: Kysely<Database>,
  name: string,
  kind = 'Document'
) => {
  const note = await db
    .selectFrom('notes')
    .selectAll()
    .where('title', '=', name)
    .executeTakeFirst()
  if (!note) {
    throw new ORPCError('NOT_FOUND', {
      message: `${kind} "${name}" not found`,
    })
  }
  return note
}

const isDailyDocument = (name: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(name)
}

const proposeRename = async (
  db: Kysely<Database>,
  oldName: string,
  newName: string
): Promise<{
  docAlreadyExists: boolean
  linksToUpdate: Array<{ title: string }>
}> => {
  const docAlreadyExists = await docExists(db, newName)

  const referencesToDoc = await db
    .selectFrom('notes')
    .select(['title'])
    .where((eb) =>
      eb(
        sql`jsonb_path_exists(parsed_body, '$.** ? (@.type == "InternalLinkBody" && @.text == $v)', jsonb_build_object('v', to_jsonb(cast(${oldName} as text))))`,
        '=',
        true
      )
    )
    .execute()

  return {
    docAlreadyExists,
    linksToUpdate: referencesToDoc,
  }
}

/**
 * Creates a new document using a template's children structure.
 * Each child gets fresh timestamps.
 */
const createFromTemplate = (
  doc: ZDoc,
  template: ZDoc,
  targetDate?: Date
): ZDoc => {
  const now = Date.now()
  let children = template.children.map((c, i) => {
    const ts = new Date(now + i).toISOString()
    return { ...c, timeCreated: ts, timeUpdated: ts }
  })
  if (targetDate) {
    children = applyTemplateDirectives(children, targetDate)
  }
  if (children.length === 0) {
    children = [lineMake(0, '')]
  }
  return { ...doc, children }
}

const createNewDocument = async (
  db: Kysely<Database>,
  name: string
): Promise<ZDoc> => {
  let newDoc = docMake([lineMake(0, '')])

  if (name === 'Tutorial') {
    newDoc.children = makeTutorial()
  } else if (isDailyDocument(name)) {
    const dailyTemplate = await db
      .selectFrom('notes')
      .selectAll()
      .where('title', '=', '$Daily')
      .executeTakeFirst()

    if (dailyTemplate) {
      const migratedBody = docMigrator(dailyTemplate.title, dailyTemplate.body)
      newDoc = createFromTemplate(
        newDoc,
        migratedBody,
        new Date(name + 'T00:00:00')
      )
    } else {
      console.log('$Daily template not found, using default content')
    }
  }

  return newDoc
}

export const docRouter = {
  searchDocs: proc
    .route({
      method: 'GET',
      path: '/documents',
      tags: ['doc'],
      summary: 'Search docs',
      description:
        'Find documents by title. Empty query returns all documents.',
    })
    .output(outputs.doc.searchDocs)
    .input(
      z.object({
        query: z.string(),
      })
    )
    .handler(async ({ input, context: { db } }) => {
      let query = db.selectFrom('notes').select(['title'])

      if (input.query.length > 0) {
        query = query.where('title', 'ilike', `%${escapeLike(input.query)}%`)
      }

      const docs = await query.execute()

      return docs.map((doc) => ({
        id: doc.title,
        title: doc.title,
        subtitle: 'Document',
      }))
    }),

  loadDoc: storedDocumentProc
    .route({
      method: 'GET',
      path: '/documents/content',
      tags: ['doc'],
      summary: 'Load doc',
      description:
        'Read a document and its revision. Pass the exact title as name.',
    })
    .output(outputs.doc.loadDoc)
    .input(
      z.object({
        name: z.string(),
      })
    )
    .handler(
      async ({
        input,
        context: { db },
      }): Promise<{ doc: ZDoc; revision: number }> => {
        const doc = await loadNote(db, input.name)

        return { doc: doc.body, revision: doc.revision }
      }
    ),

  loadDocDetails: proc
    .route({
      method: 'GET',
      path: '/documents/details',
      tags: ['doc'],
      summary: 'Load doc details',
      description: 'Read creation and update timestamps and revision.',
    })
    .output(outputs.doc.loadDocDetails)
    .input(
      z.object({
        name: z.string(),
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const doc = await loadNote(db, input.name)

      return {
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        revision: doc.revision,
      }
    }),

  updateDoc: storedDocumentProc
    .route({
      method: 'PUT',
      path: '/documents/content',
      tags: ['doc'],
      summary: 'Update doc',
      description:
        'Replace a document and rebuild derived data. Supply expectedRevision to detect concurrent edits. A stale revision returns status conflict with the current document; no write occurs. Without expectedRevision this upserts unconditionally.',
    })
    .output(outputs.doc.updateDoc)
    .input(
      z.object({
        name: z.string(),
        doc: zdoc,
        // When provided, the write is conditional: if the stored revision no
        // longer matches (e.g. a bulk rewrite like a tag rename touched this
        // document since the client last loaded it), nothing is written and
        // the stored document comes back so the caller can offer resolution.
        expectedRevision: z.number().optional(),
      })
    )
    .handler(
      async ({
        input,
        context: { db },
      }): Promise<
        | { status: 'ok'; revision: number }
        | { status: 'conflict'; serverDoc: ZDoc; serverRevision: number }
      > => {
        return await db.transaction().execute(async (tx) => {
          if (input.expectedRevision !== undefined) {
            // Lock the row so a concurrent conditional write serializes behind
            // this one instead of both passing the check.
            const current = await tx
              .selectFrom('notes')
              .select(['revision', 'body'])
              .where('title', '=', input.name)
              .forUpdate()
              .executeTakeFirst()
            if (!current) {
              // The client expected a specific revision of a document that no
              // longer exists; recreating it here would resurrect a deletion.
              throw new ORPCError('NOT_FOUND', {
                message: `Document "${input.name}" no longer exists (expected revision ${input.expectedRevision})`,
              })
            }
            if (current.revision !== input.expectedRevision) {
              return {
                status: 'conflict' as const,
                serverDoc: current.body,
                serverRevision: current.revision,
              }
            }
          }
          const revision = await upsertNoteInTx(tx, input.name, input.doc)
          return { status: 'ok' as const, revision }
        })
      }
    ),

  renameDocPropose: proc
    .route({
      method: 'POST',
      path: '/documents/rename/preview',
      tags: ['doc'],
      summary: 'Rename doc propose',
      description:
        'Preview a document rename and the incoming links it would rewrite.',
    })
    .output(outputs.doc.renameDocPropose)
    .input(
      z.object({
        oldName: z.string(),
        newName: documentNameSchema,
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const { oldName, newName } = input
      return await proposeRename(db, oldName, newName)
    }),

  renameDocExecute: proc
    .route({
      method: 'POST',
      path: '/documents/rename',
      tags: ['doc'],
      summary: 'Rename doc execute',
      description:
        'Rename a document and rewrite incoming links in one transaction.',
    })
    .output(outputs.doc.renameDocExecute)
    .input(
      z.object({
        oldName: z.string(),
        newName: documentNameSchema,
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const { oldName, newName } = input

      // One transaction covers the existence check, every link rewrite, and
      // the rename itself, so a failure partway leaves nothing half-renamed.
      return await db.transaction().execute(async (tx) => {
        const { docAlreadyExists, linksToUpdate } = await proposeRename(
          tx,
          oldName,
          newName
        )

        if (docAlreadyExists) {
          throw new ORPCError('CONFLICT', {
            message: `Document with name "${newName}" already exists`,
          })
        }

        const notesToUpdate =
          linksToUpdate.length > 0
            ? await tx
                .selectFrom('notes')
                .select(['body', 'title'])
                .where(
                  'title',
                  'in',
                  linksToUpdate.map((l) => l.title)
                )
                .where('parsed_body', 'is not', null)
                .execute()
            : []

        let linksUpdated = 0
        // In order to be reliable about how we update InternalLinks,
        // it gets a little complicated -- we do a real parse of the body,
        // then use the indices we gain from that along with a library MagicString
        // to update the body (since there could be multiple InternalLinks
        // on the same line and a naive update might change the length of the
        // string or miss updates)
        for (const noteToUpd of notesToUpdate) {
          let contentChanged = false

          const newNoteBody = produce(noteToUpd.body, (draft) => {
            draft.children.forEach((ln, idx) => {
              const parsedContent = TEKNE_MD_PARSER.parse(ln.mdContent)
              const newMdContent = new MagicString(ln.mdContent)

              visitMdTree(parsedContent.topNode, '', 0, (node: SyntaxNode) => {
                const txt = ln.mdContent.slice(node.from, node.to)
                if (node.type.name === 'InternalLinkBody' && txt === oldName) {
                  newMdContent.update(node.from, node.to, newName)
                  linksUpdated++
                }
              })

              if (newMdContent.toString() !== ln.mdContent) {
                draft.children[idx].mdContent = newMdContent.toString()
                contentChanged = true
              }
            })
          })

          if (contentChanged) {
            await upsertNoteInTx(tx, noteToUpd.title, newNoteBody)
          }
        }

        await tx
          .updateTable('notes')
          .set({ title: newName })
          .where('title', '=', oldName)
          .execute()

        return { success: true, newName, linksUpdated }
      })
    }),

  createDoc: proc
    .route({
      method: 'POST',
      path: '/documents',
      tags: ['doc'],
      summary: 'Create doc',
      description:
        'Create a document. Daily names use $Daily when available; Tutorial uses built-in content. Existing names return 409.',
    })
    .output(outputs.doc.createDoc)
    .input(
      z.object({
        name: documentNameSchema,
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const { name } = input

      if (await docExists(db, name)) {
        throw new ORPCError('CONFLICT', {
          message: `Document with name "${name}" already exists`,
        })
      }

      const newDoc = await createNewDocument(db, name)

      await upsertNote(db, name, newDoc)

      return { success: true, name }
    }),

  validateAllDocs: proc
    .route({
      method: 'GET',
      path: '/maintenance/documents/validation',
      tags: ['doc'],
      summary: 'Validate all docs',
      description:
        'Validate all stored documents and report migration options. Does not write.',
    })
    .output(outputs.doc.validateAllDocs)
    .input(z.object({}).optional())
    .handler(async ({ context: { db } }) => {
      const allDocs = await db.selectFrom('notes').selectAll().execute()

      const results = allDocs.map((doc) => {
        return validateDocumentWithMigrationCheck(doc.title, doc.body)
      })

      const validDocs = results.filter((r) => r.valid)
      const invalidDocs = results.filter((r) => !r.valid)
      const fixableDocs = invalidDocs.filter((r) => r.canBeFxedByMigration)
      const unfixableDocs = invalidDocs.filter((r) => !r.canBeFxedByMigration)

      const summary = {
        totalDocs: results.length,
        validDocs: validDocs.length,
        invalidDocs: invalidDocs.length,
        fixableByMigration: fixableDocs.length,
        unfixable: unfixableDocs.length,
      }

      return {
        summary,
        results: invalidDocs, // Return all invalid docs with migration info
      }
    }),

  migrateAllDocs: proc
    .route({
      method: 'POST',
      path: '/maintenance/documents/migrate',
      tags: ['doc'],
      summary: 'Migrate all docs',
      description:
        'Migrate all stored documents to the current schema and rebuild derived data in one transaction.',
    })
    .output(outputs.doc.migrateAllDocs)
    .input(z.void())
    .handler(async ({ context: { db } }) => {
      // One transaction so a failure partway leaves no documents migrated, and
      // upsertNoteInTx so derived data (note_data, note_lines, parsed_body)
      // tracks the rewritten bodies and revisions record the change.
      return await db.transaction().execute(async (tx) => {
        const allDocs = await tx.selectFrom('notes').selectAll().execute()

        const migrationReports = []
        let migratedCount = 0

        for (const doc of allDocs) {
          const { migratedBody, report } = migrateDocWithReport(
            doc.title,
            doc.body
          )

          migrationReports.push(report)

          if (report.migrated) {
            await upsertNoteInTx(tx, doc.title, migratedBody)
            migratedCount++
          }
        }

        const summary = {
          totalDocs: allDocs.length,
          migratedDocs: migratedCount,
          unchangedDocs: allDocs.length - migratedCount,
        }

        return {
          summary,
          reports: migrationReports.filter((r) => r.migrated), // Only return docs that were actually migrated
        }
      })
    }),

  recomputeAllData: proc
    .route({
      method: 'POST',
      path: '/maintenance/documents/recompute',
      tags: ['doc'],
      summary: 'Recompute all data',
      description:
        'Rebuild derived search, tag and aggregate data for every document.',
    })
    .output(outputs.doc.recomputeAllData)
    .input(z.void())
    .handler(async ({ context: { db } }) => {
      const result = await recomputeAllDocumentData(db)
      return result
    }),

  deleteDoc: proc
    .route({
      method: 'DELETE',
      path: '/documents',
      tags: ['doc'],
      summary: 'Delete doc',
      description:
        'Delete a document and its derived data. Send name in the JSON body.',
    })
    .output(outputs.doc.deleteDoc)
    .input(
      z.object({
        name: documentNameSchema,
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const { name } = input

      if (!(await docExists(db, name))) {
        throw new ORPCError('NOT_FOUND', {
          message: `Document "${name}" not found`,
        })
      }

      // Delete document (note_data will cascade delete automatically)
      await db.deleteFrom('notes').where('title', '=', name).execute()

      return { success: true, name }
    }),

  listTemplates: proc
    .route({
      method: 'GET',
      path: '/templates',
      tags: ['doc'],
      summary: 'List templates',
      description: 'List document titles beginning with $.',
    })
    .output(outputs.doc.listTemplates)
    .input(z.object({}).optional())
    .handler(async ({ context: { db } }) => {
      const templates = await db
        .selectFrom('notes')
        .select(['title'])
        .where('title', 'like', '$%')
        .execute()
      return templates.map((t) => t.title)
    }),

  createDocFromTemplate: proc
    .route({
      method: 'POST',
      path: '/documents/from-template',
      tags: ['doc'],
      summary: 'Create doc from template',
      description:
        'Create a document from templateName with fresh line timestamps. Daily names apply date directives.',
    })
    .output(outputs.doc.createDocFromTemplate)
    .input(
      z.object({
        name: documentNameSchema,
        templateName: z.string(),
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const { name, templateName } = input

      if (await docExists(db, name)) {
        throw new ORPCError('CONFLICT', {
          message: `Document "${name}" already exists`,
        })
      }

      const template = await loadNote(db, templateName, 'Template')
      const migratedBody = docMigrator(template.title, template.body)

      const targetDate = isDailyDocument(name)
        ? new Date(name + 'T00:00:00')
        : undefined

      const newDoc = createFromTemplate(
        docMake([lineMake(0, '')]),
        migratedBody,
        targetDate
      )

      await upsertNote(db, name, newDoc)

      return { success: true, name }
    }),
}
