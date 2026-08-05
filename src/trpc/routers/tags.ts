import { z } from 'zod'
import type { Kysely } from 'kysely'
import { t } from '../init'
import type { Database } from '@/db'
import { tagNameSchema } from '@/docs/validation'
import {
  computeRenamePairs,
  findChildTags,
  rewriteDocTags,
  type ChangedLine,
} from '@/docs/tag-rename'
import type { ZDoc, ZLine } from '@/docs/schema'
import { upsertNoteInTx } from './doc'

const renameInputSchema = z
  .object({
    oldName: tagNameSchema,
    newName: tagNameSchema,
    includeChildren: z.boolean().default(false),
  })
  .refine((i) => i.oldName !== i.newName, {
    message: 'New tag name must differ from the old one',
  })

type RenameInput = z.infer<typeof renameInputSchema>

export type ProposedLine = ChangedLine &
  Pick<
    ZLine,
    'indent' | 'datumTaskStatus' | 'datumTimeSeconds' | 'datumPinnedAt'
  >

export type ProposedDoc = {
  title: string
  isTemplate: boolean
  lines: ProposedLine[]
}

export type TagRenameProposal = {
  targetExists: boolean
  childTags: string[]
  renames: Array<{ from: string; to: string }>
  totalLines: number
  docs: Array<ProposedDoc>
  /** Every tag name in use before the rename, without the leading '#' */
  usedNames: string[]
  /** Documents whose new body to apply on execute, keyed by title */
  newDocs: Map<string, ZDoc>
}

/** All tag names in the database, without the leading '#'. */
const getAllTagNames = async (db: Kysely<Database>): Promise<string[]> => {
  const rows = await db
    .selectFrom('note_data')
    .select(['datum_tag'])
    .where('datum_type', '=', 'tag')
    .distinct()
    .execute()
  return rows.map((r) => r.datum_tag.slice(1))
}

/** Names of archived tags, without the leading '#'. */
const getArchivedTagNames = async (
  db: Kysely<Database>
): Promise<Set<string>> => {
  const rows = await db
    .selectFrom('tags')
    .select(['tag_name'])
    .where('archived_at', 'is not', null)
    .execute()
  return new Set(rows.map((r) => r.tag_name))
}

/**
 * Computes the full effect of a tag rename/merge without applying it.
 * Execute re-runs this inside its transaction so what is applied always
 * reflects current document state; the client-facing preview is advisory.
 */
const proposeTagRename = async (
  db: Kysely<Database>,
  input: RenameInput
): Promise<TagRenameProposal> => {
  const allNames = await getAllTagNames(db)

  const childTags = findChildTags(input.oldName, allNames)
  const targetExists = allNames.includes(input.newName)
  const pairs = computeRenamePairs(
    input.oldName,
    input.newName,
    allNames,
    input.includeChildren
  )

  // note_data includes rows for lines that only *inherit* a tag from an
  // ancestor line, but at the document level this is still an exact filter:
  // an inherited tag implies a literal occurrence somewhere in the doc.
  const candidates = await db
    .selectFrom('note_data')
    .select(['note_title'])
    .where('datum_type', '=', 'tag')
    .where(
      'datum_tag',
      'in',
      [...pairs.keys()].map((name) => '#' + name)
    )
    .distinct()
    .execute()

  const docs: ProposedDoc[] = []
  const newDocs: TagRenameProposal['newDocs'] = new Map()
  let totalLines = 0

  const notes =
    candidates.length === 0
      ? []
      : await db
          .selectFrom('notes')
          .select(['title', 'body'])
          .where(
            'title',
            'in',
            candidates.map((c) => c.note_title)
          )
          .orderBy('title')
          .execute()

  for (const note of notes) {
    const { title } = note
    const { newDoc, changedLines } = rewriteDocTags(note.body, pairs)
    if (changedLines.length === 0) {
      continue
    }

    newDocs.set(title, newDoc)
    totalLines += changedLines.length
    docs.push({
      title,
      isTemplate: title.startsWith('$'),
      lines: changedLines.map((cl) => {
        const line = note.body.children[cl.lineIdx]
        return {
          ...cl,
          indent: line.indent,
          datumTaskStatus: line.datumTaskStatus,
          datumTimeSeconds: line.datumTimeSeconds,
          datumPinnedAt: line.datumPinnedAt,
        }
      }),
    })
  }

  return {
    targetExists,
    childTags,
    renames: [...pairs.entries()].map(([from, to]) => ({ from, to })),
    totalLines,
    docs,
    usedNames: allNames,
    newDocs,
  }
}

/**
 * Moves tag metadata along with a rename. On merge, the target's existing
 * metadata wins; the source's fills a blank. Archived state only follows a
 * pure rename -- merging a retired tag into one that is still in use must not
 * retire the survivor.
 */
const migrateTagMetadata = async (
  db: Kysely<Database>,
  renames: Array<{ from: string; to: string }>,
  usedNames: Set<string>
) => {
  for (const { from, to } of renames) {
    const source = await db
      .selectFrom('tags')
      .selectAll()
      .where('tag_name', '=', from)
      .executeTakeFirst()
    if (!source) {
      continue
    }

    const target = await db
      .selectFrom('tags')
      .selectAll()
      .where('tag_name', '=', to)
      .executeTakeFirst()

    const description =
      target?.description ?? (source.description || null) ?? null
    const isRename = !target && !usedNames.has(to)
    const archived_at = target
      ? target.archived_at
      : isRename
        ? source.archived_at
        : null

    if (description !== null || archived_at !== null) {
      await db
        .insertInto('tags')
        .values({
          tag_name: to,
          description,
          archived_at,
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc.column('tag_name').doUpdateSet({
            description,
            archived_at,
            updated_at: new Date(),
          })
        )
        .execute()
    }

    await db.deleteFrom('tags').where('tag_name', '=', from).execute()
  }
}

export const tagsRouter = t.router({
  /**
   * All tags that occur in the whole database plus tags that only have
   * metadata, with usage counts and descriptions.
   */
  list: t.procedure.query(async ({ ctx: { db } }) => {
    const usage = await db
      .selectFrom('note_data')
      .select((eb) => [
        'datum_tag',
        eb.fn.countAll<number>().as('line_count'),
        eb.fn.count<number>('note_title').distinct().as('doc_count'),
      ])
      .where('datum_type', '=', 'tag')
      .groupBy('datum_tag')
      .execute()

    const meta = await db.selectFrom('tags').selectAll().execute()

    const byName = new Map<
      string,
      {
        name: string
        description: string | null
        archived: boolean
        lineCount: number
        docCount: number
      }
    >()
    for (const row of usage) {
      const name = row.datum_tag.slice(1)
      byName.set(name, {
        name,
        description: null,
        archived: false,
        lineCount: Number(row.line_count),
        docCount: Number(row.doc_count),
      })
    }
    for (const row of meta) {
      const existing = byName.get(row.tag_name)
      if (existing) {
        existing.description = row.description
        existing.archived = row.archived_at !== null
      } else {
        byName.set(row.tag_name, {
          name: row.tag_name,
          description: row.description,
          archived: row.archived_at !== null,
          lineCount: 0,
          docCount: 0,
        })
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }),

  /**
   * Tag names offered for new use (no leading '#') -- feeds autocomplete.
   * Archived tags are left out: they stay valid where they already occur,
   * they just stop being suggested.
   */
  allTags: t.procedure.query(async ({ ctx: { db } }) => {
    const [names, archived] = await Promise.all([
      getAllTagNames(db),
      getArchivedTagNames(db),
    ])
    return names.filter((name) => !archived.has(name))
  }),

  /**
   * Archives or restores a tag. This is metadata only -- documents keep every
   * occurrence of the tag, so it is reversible.
   */
  setArchived: t.procedure
    .input(
      z.object({
        name: tagNameSchema,
        archived: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      if (!input.archived) {
        // Rows exist only for tags with metadata, so an unarchived tag with no
        // description leaves nothing behind.
        const existing = await db
          .selectFrom('tags')
          .select(['description'])
          .where('tag_name', '=', input.name)
          .executeTakeFirst()

        if (!existing) {
          return { success: true }
        }

        if (existing.description === null) {
          await db
            .deleteFrom('tags')
            .where('tag_name', '=', input.name)
            .execute()
        } else {
          await db
            .updateTable('tags')
            .set({ archived_at: null, updated_at: new Date() })
            .where('tag_name', '=', input.name)
            .execute()
        }

        return { success: true }
      }

      const archived_at = new Date()
      await db
        .insertInto('tags')
        .values({
          tag_name: input.name,
          description: null,
          archived_at,
          updated_at: archived_at,
        })
        .onConflict((oc) =>
          oc.column('tag_name').doUpdateSet({
            archived_at,
            updated_at: archived_at,
          })
        )
        .execute()

      return { success: true }
    }),

  setDescription: t.procedure
    .input(
      z.object({
        name: tagNameSchema,
        description: z.string().max(2000),
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const description = input.description.trim()

      if (description === '') {
        // Clearing the description only drops the row if nothing else lives on
        // it -- an archived tag keeps its row.
        const existing = await db
          .selectFrom('tags')
          .select(['archived_at'])
          .where('tag_name', '=', input.name)
          .executeTakeFirst()

        if (existing?.archived_at) {
          await db
            .updateTable('tags')
            .set({ description: null, updated_at: new Date() })
            .where('tag_name', '=', input.name)
            .execute()
        } else {
          await db
            .deleteFrom('tags')
            .where('tag_name', '=', input.name)
            .execute()
        }
        return { success: true }
      }

      await db
        .insertInto('tags')
        .values({
          tag_name: input.name,
          description,
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc.column('tag_name').doUpdateSet({
            description,
            updated_at: new Date(),
          })
        )
        .execute()

      return { success: true }
    }),

  renamePropose: t.procedure
    .input(renameInputSchema)
    .mutation(async ({ input, ctx: { db } }) => {
      // newDocs (full rewritten bodies) stays server-side; the client only
      // needs the preview
      const proposal = await proposeTagRename(db, input)
      return {
        targetExists: proposal.targetExists,
        childTags: proposal.childTags,
        renames: proposal.renames,
        totalLines: proposal.totalLines,
        docs: proposal.docs,
      }
    }),

  renameExecute: t.procedure
    .input(renameInputSchema)
    .mutation(async ({ input, ctx: { db } }) => {
      return await db.transaction().execute(async (tx) => {
        const proposal = await proposeTagRename(tx, input)

        for (const [title, newDoc] of proposal.newDocs) {
          await upsertNoteInTx(tx, title, newDoc)
        }

        await migrateTagMetadata(
          tx,
          proposal.renames,
          new Set(proposal.usedNames)
        )

        return {
          success: true,
          docsUpdated: proposal.newDocs.size,
          linesUpdated: proposal.totalLines,
        }
      })
    }),
})
