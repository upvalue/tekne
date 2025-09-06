import z from 'zod'
import { lineMake, zdoc, type ZDoc } from '@/editor/schema'
import { initTRPC } from '@trpc/server'
import type { Database } from '@/db'
import { sql, type Kysely } from 'kysely'
import { documentNameSchema } from '@/lib/validation'
import { makeTutorial } from '@/lib/tutorial'

import fs from 'fs'
import child_process from 'child_process'
import type { DBNote } from '@/db/types'

export const t = initTRPC.context<{ db: Kysely<Database> }>().create({
  allowOutsideOfServer: true,
})

export const router = t.router
export const proc = t.procedure

/**
 * While developing, it's sometimes useful to just change
 * the schema of data on the fly while not making a big deal
 * out of it with the database
 */
const docMigrator = (doc: any): any => {
  doc.body.children = doc.body.children.map((child: any) => {
    const mod = { ...child }
    if (!child.timeCreated && child.createdAt) {
      mod.timeCreated = mod.createdAt
    }
    if (!child.timeUpdated && child.updatedAt) {
      mod.timeUpdated = mod.updatedAt
    }
    if (child.datumTaskStatus) {
      mod.datumTaskStatus = child.datumTaskStatus
    }
    return mod
  })
  return {
    ...doc,
    body: {
      ...doc.body,
      schemaVersion: 1,
    },
  }
}

const upsertNote = (db: Kysely<Database>, name: string, body: ZDoc) => {
  const r = db
    .insertInto('notes')
    .values({
      title: name,
      body,
      revision: 0,
      updatedAt: sql`now()`,
    })
    .onConflict((oc) => oc.column('title').doUpdateSet({ body }))
    .execute()

  console.log('upsertNote', r)
  return r
}

const isDailyDocument = (name: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(name)
}

// TODO: Fix any
const createFromTemplate = (doc: ZDoc, tmpl: any): ZDoc => {
  console.log({ doc, tmpl })
  return {
    ...doc,
    children: tmpl.body.children.map((c) => ({
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
    schemaVersion: 1,
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

export const appRouter = router({
  healthcheck: proc.query(async ({ ctx: { db } }) => {
    const q = await db
      .selectFrom(sql`(select 1)`.as('subquery'))
      .selectAll()
      .execute()

    return q
  }),

  ping: proc.query(() => {
    return 'pong2'
  }),

  searchDocs: proc
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

  loadDoc: proc
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

      doc = docMigrator(doc)

      return doc!.body
    }),

  loadDocDetails: proc
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

  updateDoc: proc
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

  renameDoc: proc
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

  execHook: proc
    .input(
      z.object({
        hook: z.enum(['timer-start', 'timer-stop']),
        argument: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('execHook', input)
      const { hook, argument } = input

      // If running on server
      if (typeof process !== 'undefined') {
        if (hook === 'timer-start' || hook === 'timer-stop') {
          const { line, lineIdx, doc } = argument

          if (fs.existsSync(`hooks/${hook}`)) {
            child_process.execSync(`hooks/${hook}`, {
              input: JSON.stringify({
                type: 'timer-event',
                line,
                lineIdx,
                doc,
              }),
            })
          }
        }
      } else {
        console.log('[hook] client execHook', hook, argument)
      }
    }),

  createDoc: proc
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
})

export type AppRouter = typeof appRouter
