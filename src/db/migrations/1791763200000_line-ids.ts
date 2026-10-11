import { sql, type Kysely } from 'kysely'
import { z } from 'zod'

// Frozen version-2 validation: later document schema changes must not change
// what this migration writes when creating a fresh database.
const version2Document = z
  .object({
    type: z.literal('doc'),
    schemaVersion: z.literal(2),
    children: z.array(
      z
        .object({
          type: z.literal('line'),
          id: z.string().regex(/^l_[A-Za-z0-9_-]{21}[AQgw]$/),
          mdContent: z.string(),
          indent: z.number().int(),
          timeCreated: z.iso.datetime(),
          timeUpdated: z.iso.datetime(),
          collapsed: z.boolean().optional(),
          datumTimeSeconds: z.number().optional(),
          datumTaskStatus: z
            .enum(['complete', 'incomplete', 'unset'])
            .optional(),
          datumPinnedAt: z.iso.datetime().optional(),
          color: z
            .enum(['yellow', 'blue', 'purple', 'red', 'green'])
            .optional(),
        })
        .passthrough()
    ),
  })
  .passthrough()

const makeId = () =>
  `l_${btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')}`

/** Preflight returns prepared documents without writing anything. */
export const prepareLineIdMigration = async (db: Kysely<any>) => {
  const notes = await db.selectFrom('notes').select(['title', 'body']).execute()
  const ids = new Set<string>()
  return notes.map((note) => {
    if (
      !note.body ||
      note.body.type !== 'doc' ||
      !Array.isArray(note.body.children)
    ) {
      throw new Error(`Invalid document structure: ${note.title}`)
    }
    if (note.body.schemaVersion > 2)
      throw new Error(`Unsupported schema: ${note.title}`)
    const body = structuredClone(note.body)
    if ((body.schemaVersion ?? 0) < 2) {
      for (const line of body.children) {
        if (!line.id) line.id = makeId()
        if (line.createdAt) {
          line.timeCreated = line.createdAt
          delete line.createdAt
        }
        if (line.updatedAt) {
          line.timeUpdated = line.updatedAt
          delete line.updatedAt
        }
        if (line.datumTime !== undefined) {
          line.datumTimeSeconds = line.datumTime
          delete line.datumTime
        }
      }
      body.schemaVersion = 2
    }
    version2Document.parse(body)
    const migratedBody = body
    for (const line of migratedBody.children) {
      if (ids.has(line.id))
        throw new Error(`Duplicate line ID in ${note.title}: ${line.id}`)
      ids.add(line.id)
    }
    return {
      title: note.title as string,
      body: migratedBody,
      changed: JSON.stringify(note.body) !== JSON.stringify(migratedBody),
    }
  })
}

export async function up(db: Kysely<any>): Promise<void> {
  await sql`lock table notes, note_lines, note_data in access exclusive mode`.execute(
    db
  )
  const notes = await prepareLineIdMigration(db)
  await db.schema
    .alterTable('note_lines')
    .addColumn('line_id', 'text')
    .execute()
  await db.schema.alterTable('note_data').addColumn('line_id', 'text').execute()
  for (const note of notes) {
    if (note.changed) {
      await db
        .updateTable('notes')
        .set({ body: note.body, revision: sql`revision + 1` })
        .where('title', '=', note.title)
        .execute()
    }
  }
  await sql`delete from note_lines`.execute(db)
  await sql`insert into note_lines (note_title, line_idx, line_id, content, indent, time_created, time_updated)
    select n.title, (l.ordinality - 1)::integer, l.body->>'id', l.body->>'mdContent',
      (l.body->>'indent')::integer, (l.body->>'timeCreated')::timestamp, (l.body->>'timeUpdated')::timestamp
    from notes n cross join lateral jsonb_array_elements(n.body->'children') with ordinality as l(body, ordinality)`.execute(
    db
  )
  await sql`update note_data d set line_id = l.line_id from note_lines l
    where d.note_title = l.note_title and d.line_idx = l.line_idx`.execute(db)
  await db.schema
    .alterTable('note_lines')
    .alterColumn('line_id', (c) => c.setNotNull())
    .execute()
  await db.schema
    .alterTable('note_data')
    .alterColumn('line_id', (c) => c.setNotNull())
    .execute()
  await db.schema
    .createIndex('note_lines_id_unique')
    .on('note_lines')
    .column('line_id')
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('note_data').dropColumn('line_id').execute()
  await db.schema.alterTable('note_lines').dropColumn('line_id').execute()
  // Preserve IDs in JSON so reapplying this migration cannot change identity.
}

export const tmigration = { up, down }
