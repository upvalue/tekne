import { outputs } from '../outputs'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import { proc } from '../init'
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

/** Update metadata independently, dropping a row only when none remains. */
const setTagMetadata = async (
  db: Kysely<Database>,
  name: string,
  metadata: { description?: string | null; archived_at?: Date | null },
  updated_at = new Date()
) => {
  const update = { ...metadata, updated_at }

  if (Object.values(metadata).every((value) => value === null)) {
    const existing = await db
      .selectFrom('tags')
      .select(['description', 'archived_at'])
      .where('tag_name', '=', name)
      .executeTakeFirst()
    if (!existing) return { success: true }

    const remaining = { ...existing, ...metadata }
    if (remaining.description === null && remaining.archived_at === null) {
      await db.deleteFrom('tags').where('tag_name', '=', name).execute()
    } else {
      await db
        .updateTable('tags')
        .set(update)
        .where('tag_name', '=', name)
        .execute()
    }
  } else {
    await db
      .insertInto('tags')
      .values({ tag_name: name, description: null, ...update })
      .onConflict((oc) => oc.column('tag_name').doUpdateSet(update))
      .execute()
  }

  return { success: true }
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
  // One batched read covers every source and target row; a namespace rename
  // with many children would otherwise hold the transaction open for two
  // queries per pair.
  const names = [...new Set(renames.flatMap(({ from, to }) => [from, to]))]
  const rows =
    names.length > 0
      ? await db
          .selectFrom('tags')
          .selectAll()
          .where('tag_name', 'in', names)
          .execute()
      : []
  const rowsByName = new Map(rows.map((row) => [row.tag_name, row]))
  const sourcesToDelete: string[] = []

  for (const { from, to } of renames) {
    const source = rowsByName.get(from)
    if (!source) {
      continue
    }
    sourcesToDelete.push(from)

    const target = rowsByName.get(to)

    const description =
      target?.description ?? (source.description || null) ?? null
    const isRename = !target && !usedNames.has(to)
    const archived_at = target
      ? target.archived_at
      : isRename
        ? source.archived_at
        : null

    if (description !== null || archived_at !== null) {
      await setTagMetadata(db, to, { description, archived_at })
    }
  }

  if (sourcesToDelete.length > 0) {
    await db
      .deleteFrom('tags')
      .where('tag_name', 'in', sourcesToDelete)
      .execute()
  }
}

export const tagsRouter = {
  /**
   * All tags that occur in the whole database plus tags that only have
   * metadata, with usage counts and descriptions.
   */
  list: proc
    .route({
      method: 'GET',
      path: '/tags',
      tags: ['tags'],
      summary: 'List',
      description:
        'List tags with descriptions, archive state and usage counts. Names omit the leading #.',
    })
    .output(outputs.tags.list)
    .input(z.object({}).optional())
    .handler(async ({ context: { db } }) => {
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
        byName.set(row.tag_name, {
          name: row.tag_name,
          lineCount: 0,
          docCount: 0,
          ...byName.get(row.tag_name),
          description: row.description,
          archived: row.archived_at !== null,
        })
      }

      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    }),

  /**
   * Tag names offered for new use (no leading '#') -- feeds autocomplete.
   * Archived tags are left out: they stay valid where they already occur,
   * they just stop being suggested.
   */
  allTags: proc
    .route({
      method: 'GET',
      path: '/tags/suggestions',
      tags: ['tags'],
      summary: 'All tags',
      description:
        'List tag names in use, excluding archived tags. Names omit the leading #.',
    })
    .output(outputs.tags.allTags)
    .input(z.object({}).optional())
    .handler(async ({ context: { db } }) => {
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
  setArchived: proc
    .route({
      method: 'PUT',
      path: '/tags/archive',
      tags: ['tags'],
      summary: 'Set archived',
      description:
        'Archive or restore a tag without changing document content.',
    })
    .output(outputs.tags.setArchived)
    .input(
      z.object({
        name: tagNameSchema,
        archived: z.boolean(),
      })
    )
    .handler(({ input, context: { db } }) => {
      const archived_at = input.archived ? new Date() : null
      return setTagMetadata(
        db,
        input.name,
        { archived_at },
        archived_at ?? undefined
      )
    }),

  setDescription: proc
    .route({
      method: 'PUT',
      path: '/tags/description',
      tags: ['tags'],
      summary: 'Set description',
      description:
        'Set a tag description (maximum 2000 characters). Blank text clears it.',
    })
    .output(outputs.tags.setDescription)
    .input(
      z.object({
        name: tagNameSchema,
        description: z.string().max(2000),
      })
    )
    .handler(({ input, context: { db } }) =>
      setTagMetadata(db, input.name, {
        description: input.description.trim() || null,
      })
    ),

  renamePropose: proc
    .route({
      method: 'POST',
      path: '/tags/rename/preview',
      tags: ['tags'],
      summary: 'Rename propose',
      description:
        'Preview a tag rename or merge. includeChildren also renames descendants. This preview is advisory; execution recomputes it.',
    })
    .output(outputs.tags.renamePropose)
    .input(renameInputSchema)
    .handler(async ({ input, context: { db } }) => {
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

  renameExecute: proc
    .route({
      method: 'POST',
      path: '/tags/rename',
      tags: ['tags'],
      summary: 'Rename execute',
      description:
        'Rename or merge tags, rewrite documents and move tag metadata in one transaction.',
    })
    .output(outputs.tags.renameExecute)
    .input(renameInputSchema)
    .handler(async ({ input, context: { db } }) => {
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
}
