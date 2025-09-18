import z from 'zod'
import {
  lineMake,
  zdoc,
  type ZDoc,
  CURRENT_SCHEMA_VERSION,
} from '@/docs/schema'
import { t } from '../init'
import type { Database } from '@/db'
import { sql, type Kysely } from 'kysely'
import { documentNameSchema } from '@/lib/validation'
import { makeTutorial } from '@/lib/tutorial'
import {
  docMigrator,
  migrateDocWithReport,
  validateDocumentWithMigrationCheck,
} from '@/docs/doc-migrator'
import {
  processDocumentForData,
  recomputeAllDocumentData,
} from '@/server/lib/docs'
import { produce } from 'immer'
import {
  jsonifyMdTree,
  TEKNE_MD_PARSER,
  visitMdTree,
} from '@/editor/line-editor/syntax-plugin'
import type { SyntaxNode } from '@lezer/common'
import MagicString from 'magic-string'

const upsertNote = async (db: Kysely<Database>, name: string, body: ZDoc) => {
  await db.transaction().execute(async (tx) => {
    const parsedBody = body.children.map((ln, line_idx) => {
      const parsedLine = TEKNE_MD_PARSER.parse(ln.mdContent)
      return {
        line_idx,
        parsed_body: jsonifyMdTree(parsedLine.topNode, ln.mdContent),
      }
    })
    const r = await tx
      .insertInto('notes')
      .values({
        title: name,
        body,
        revision: 0,
        parsed_body: JSON.stringify(parsedBody),
        updatedAt: sql`now()`,
      })
      .onConflict((oc) => oc.column('title').doUpdateSet({ body }))
      .execute()

    // Process document for data using shared function
    const processedData = processDocumentForData(name, body)

    // Drop all data by note title
    await tx.deleteFrom('note_data').where('note_title', '=', name).execute()

    if (processedData.length > 0) {
      await tx.insertInto('note_data').values(processedData).execute()
    }

    console.log('upsertNote', r)
  })
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
  let docAlreadyExists = false

  const existingDoc = await db
    .selectFrom('notes')
    .select(['title'])
    .where('title', '=', newName)
    .executeTakeFirst()

  docAlreadyExists = existingDoc !== undefined

  console.log({ oldName })
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

// TODO: Fix any
const createFromTemplate = (doc: ZDoc, tmpl: any): ZDoc => {
  console.log({ doc, tmpl })
  return {
    ...doc,
    children: tmpl.body.children.map((c: any) => ({
      ...c,
      timeCreated: new Date().toISOString(),
      timeUpdated: new Date().toISOString(),
    })),
  }
}

const createNewDocument = async (
  db: Kysely<Database>,
  name: string
): Promise<ZDoc> => {
  let newDoc: ZDoc = {
    type: 'doc',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    children: [lineMake(0, '')],
  }

  if (name === 'Tutorial') {
    newDoc.children = makeTutorial()
  } else if (isDailyDocument(name)) {
    const dailyTemplate = await db
      .selectFrom('notes')
      .selectAll()
      .where('title', '=', '$Daily')
      .executeTakeFirst()

    if (dailyTemplate) {
      const templateDoc = docMigrator(dailyTemplate)
      newDoc = createFromTemplate(newDoc, templateDoc)
    } else {
      console.log('$Daily template not found, using default content')
    }
  }

  return newDoc
}

export const docRouter = t.router({
  searchDocs: t.procedure
    .input(
      z.object({
        query: z.string(),
      })
    )
    .query(async ({ input, ctx: { db } }) => {
      let query = db.selectFrom('notes').select(['title'])

      if (input.query.length > 0) {
        query = query.where('title', 'ilike', `%${input.query}%`)
      }

      const docs = await query.execute()

      return docs.map((doc) => ({
        id: doc.title,
        title: doc.title,
        subtitle: 'Document',
      }))
    }),

  loadDoc: t.procedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(async ({ input, ctx: { db } }): Promise<ZDoc> => {
      const doc = await db
        .selectFrom('notes')
        .selectAll()
        .where('title', '=', input.name)
        .executeTakeFirst()

      if (!doc) {
        const mydoc = await createNewDocument(db, input.name)
        await upsertNote(db, input.name, mydoc)
        return mydoc
      }

      return doc!.body
    }),

  loadDocDetails: t.procedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(async ({ input, ctx: { db } }) => {
      const doc = await db
        .selectFrom('notes')
        .selectAll()
        .where('title', '=', input.name)
        .executeTakeFirst()

      if (!doc) {
        throw new Error(`Document "${input.name}" not found`)
      }

      return {
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        revision: doc.revision,
      }
    }),

  updateDoc: t.procedure
    .input(
      z.object({
        name: z.string(),
        doc: zdoc,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      await upsertNote(db, input.name, input.doc)

      return true
    }),

  renameDocPropose: t.procedure
    .input(
      z.object({
        oldName: z.string(),
        newName: documentNameSchema,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const { oldName, newName } = input
      return await proposeRename(db, oldName, newName)
    }),

  renameDocExecute: t.procedure
    .input(
      z.object({
        oldName: z.string(),
        newName: documentNameSchema,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const { oldName, newName } = input

      const { docAlreadyExists, linksToUpdate } = await proposeRename(
        db,
        oldName,
        newName
      )

      if (docAlreadyExists) {
        return {
          success: false,
          newName: oldName,
          error: `Document with name "${newName}" already exists`,
        }
      }

      // In order to be reliable about how we update InternalLinks,
      // it gets a little complicated -- we do a real parse of the body,
      // then use the indices we gain from that along with a library MagicString
      // to update the body (since there could be multiple InternalLinks
      // on the same line and a naive update might change the length of the
      // string or miss updates)
      for (const link of linksToUpdate) {
        const noteToUpd = await db
          .selectFrom('notes')
          .select(['body', 'title'])
          .where('title', '=', link.title)
          .where('parsed_body', 'is not', null)
          .executeTakeFirst()

        if (!noteToUpd) {
          throw new Error(`Document ${link.title} not found`)
        }

        let contentChanged = false

        const newNoteBody = produce(noteToUpd.body, (draft) => {
          draft.children.forEach((ln, idx) => {
            const parsedContent = TEKNE_MD_PARSER.parse(ln.mdContent)
            const newMdContent = new MagicString(ln.mdContent)

            visitMdTree(parsedContent.topNode, '', 0, (node: SyntaxNode) => {
              const txt = ln.mdContent.slice(node.from, node.to)
              if (node.type.name === 'InternalLinkBody' && txt === oldName) {
                newMdContent.update(node.from, node.to, newName)
                console.log(
                  `Updating link to doc ${oldName} in doc ${noteToUpd.title} on line ${idx} from ${node.from} to ${node.to}`
                )
                console.log(
                  'New body for line ',
                  idx,
                  ':',
                  newMdContent.toString()
                )
              }
            })

            if (newMdContent.toString() !== ln.mdContent) {
              draft.children[idx].mdContent = newMdContent.toString()
              contentChanged = true
            }
          })
        })

        await upsertNote(db, noteToUpd.title, newNoteBody)
      }

      await db
        .updateTable('notes')
        .set({ title: newName })
        .where('title', '=', oldName)
        .execute()

      return { success: true, newName }
    }),

  createDoc: t.procedure
    .input(
      z.object({
        name: documentNameSchema,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const { name } = input

      // Check if document already exists
      const existingDoc = await db
        .selectFrom('notes')
        .select(['title'])
        .where('title', '=', name)
        .executeTakeFirst()

      if (existingDoc) {
        throw new Error(`Document with name "${name}" already exists`)
      }

      const newDoc = await createNewDocument(db, name)

      await upsertNote(db, name, newDoc)

      return { success: true, name }
    }),

  validateAllDocs: t.procedure.query(async ({ ctx: { db } }) => {
    const allDocs = await db.selectFrom('notes').selectAll().execute()

    const results = allDocs.map((doc) => {
      return validateDocumentWithMigrationCheck(doc)
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

  migrateAllDocs: t.procedure.mutation(async ({ ctx: { db } }) => {
    const allDocs = await db.selectFrom('notes').selectAll().execute()

    const migrationReports = []
    let migratedCount = 0

    // Process each document
    for (const doc of allDocs) {
      const { migratedDoc, report } = migrateDocWithReport(doc)

      migrationReports.push(report)

      if (report.migrated) {
        // Update the document in the database
        await db
          .updateTable('notes')
          .set({
            body: migratedDoc.body,
            updatedAt: new Date(),
          })
          .where('title', '=', doc.title)
          .execute()

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
  }),

  recomputeAllData: t.procedure.mutation(async ({ ctx: { db } }) => {
    const result = await recomputeAllDocumentData(db)
    return result
  }),

  deleteDoc: t.procedure
    .input(
      z.object({
        name: documentNameSchema,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const { name } = input

      // Check if document exists
      const existingDoc = await db
        .selectFrom('notes')
        .select(['title'])
        .where('title', '=', name)
        .executeTakeFirst()

      if (!existingDoc) {
        throw new Error(`Document "${name}" not found`)
      }

      // Delete document (note_data will cascade delete automatically)
      await db.deleteFrom('notes').where('title', '=', name).execute()

      return { success: true, name }
    }),

  /**
   * Returns all tags that occur in the whole database
   */
  allTags: t.procedure.query(async ({ ctx: { db } }) => {
    const tags = await db
      .selectFrom('note_data')
      .select(['datum_tag'])
      .where('datum_type', '=', 'tag')
      .distinct()
      .execute()
    return tags.map((t) => t.datum_tag.slice(1))
  }),
})
