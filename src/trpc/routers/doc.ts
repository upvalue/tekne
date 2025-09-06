import z from 'zod'
import { lineMake, zdoc, type ZDoc, type ZLine, CURRENT_SCHEMA_VERSION } from '@/editor/schema'
import { t } from '../init'
import type { Database } from '@/db'
import { sql, type Kysely } from 'kysely'
import { documentNameSchema } from '@/lib/validation'
import { makeTutorial } from '@/lib/tutorial'
import {
  docMigrator,
  migrateDocWithReport,
  validateDocumentWithMigrationCheck,
} from '@/editor/doc-migrator'
import { extractDocData, treeifyDoc } from '@/editor/doc-analysis'

const linesToZodDoc = (title: string, children: Array<ZLine>): ZDoc => {
  return {
    type: 'doc',
    children,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
}

const upsertNote = async (db: Kysely<Database>, name: string, body: ZDoc) => {
  await db.transaction().execute(async (tx) => {
    const r = await tx
      .insertInto('notes')
      .values({
        title: name,
        body,
        revision: 0,
        updatedAt: sql`now()`,
      })
      .onConflict((oc) => oc.column('title').doUpdateSet({ body }))
      .execute()

    // Analyze doc to get data
    const tree = treeifyDoc(linesToZodDoc(name, body.children))
    const data = extractDocData(tree.children)

    // Drop all data by note title
    await tx.deleteFrom('note_data').where('note_title', '=', name).execute()

    await tx
      .insertInto('note_data')
      .values(
        data.map((d) => ({
          note_title: name,
          line_idx: d.lineIdx,
          time_created: new Date(d.timeCreated),
          time_updated: new Date(d.timeUpdated),
          datum_tag: d.datumTag,
          datum_status: d.datumStatus,
          datum_time_seconds: d.datumTimeSeconds,
          datum_type: d.datumType,
        }))
      )
      .execute()

    console.log('upsertNote', r)
  })
}

const isDailyDocument = (name: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(name)
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
      let doc = await db
        .selectFrom('notes')
        .selectAll()
        .where('title', '=', input.name)
        .executeTakeFirst()

      if (!doc) {
        const mydoc = await createNewDocument(db, input.name)
        await upsertNote(db, input.name, mydoc)
        return mydoc
      }

      // doc = docMigrator(doc)

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

  renameDoc: t.procedure
    .input(
      z.object({
        oldName: z.string(),
        newName: documentNameSchema,
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const { oldName, newName } = input

      // Check if new name already exists
      const existingDoc = await db
        .selectFrom('notes')
        .select(['title'])
        .where('title', '=', newName)
        .executeTakeFirst()

      if (existingDoc) {
        throw new Error(`Document with name "${newName}" already exists`)
      }

      // Get the old document
      const oldDoc = await db
        .selectFrom('notes')
        .selectAll()
        .where('title', '=', oldName)
        .executeTakeFirst()

      if (!oldDoc) {
        throw new Error(`Document "${oldName}" not found`)
      }

      // Create new document and delete old one
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('notes')
          .values({
            ...oldDoc,
            updatedAt: sql`now()`,
            title: newName,
          })
          .execute()

        await trx.deleteFrom('notes').where('title', '=', oldName).execute()
      })

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
})