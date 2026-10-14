import type { Database } from '@/db'
import { sql, type Kysely } from 'kysely'
import type { ZDoc } from '@/docs/schema'
import { extractDocData, treeifyDoc } from '@/docs/doc-analysis'
import { jsonifyMdTree, TEKNE_MD_PARSER } from '@/docs/parser'

/** Extract tagged document data as rows for database insertion. */
export const processDocumentForData = (title: string, doc: ZDoc) => {
  const tree = treeifyDoc(doc)
  const data = extractDocData(tree.children)

  return data.map((d) => ({
    note_title: title,
    line_idx: d.lineIdx,
    line_id: d.lineId,
    time_created: new Date(d.timeCreated),
    time_updated: new Date(d.timeUpdated),
    datum_tag: d.datumTag,
    datum_status: d.datumStatus,
    datum_time_seconds: d.datumTimeSeconds,
    datum_pinned_at: d.datumPinnedAt,
    datum_pinned_content: d.datumPinnedContent,
    datum_type: d.datumType,
  }))
}

/**
 * Everything a note's body determines: the per-line parsed markdown stored on
 * the note itself, the extracted data rows, and the line rows backing text
 * search.
 */
export const deriveNoteRows = (title: string, body: ZDoc) => {
  const parsedBody = body.children.map((ln, line_idx) => {
    const parsedLine = TEKNE_MD_PARSER.parse(ln.mdContent)
    return {
      line_idx,
      parsed_body: jsonifyMdTree(parsedLine.topNode, ln.mdContent),
    }
  })

  const noteData = processDocumentForData(title, body)

  const noteLines = body.children.map((ln, line_idx) => ({
    note_title: title,
    line_idx,
    line_id: ln.id,
    content: ln.mdContent,
    indent: ln.indent,
    time_created: new Date(ln.timeCreated),
    time_updated: new Date(ln.timeUpdated),
  }))

  return { parsedBody, noteData, noteLines }
}

/** Rebuild derived data, including parsed_body, without changing document bodies. */
export const recomputeAllDocumentData = async (db: Kysely<Database>) => {
  const results = await db.transaction().execute(async (tx) => {
    const allDocs = await tx
      .selectFrom('notes')
      .selectAll()
      .orderBy('title')
      .forUpdate()
      .execute()

    await tx.deleteFrom('note_data').execute()
    await tx.deleteFrom('note_lines').execute()

    let processedCount = 0
    let totalDataRows = 0
    let totalLineRows = 0

    for (const doc of allDocs) {
      const { parsedBody, noteData, noteLines } = deriveNoteRows(
        doc.title,
        doc.body
      )

      await tx
        .updateTable('notes')
        .set({ parsed_body: sql`${JSON.stringify(parsedBody)}::jsonb` })
        .where('title', '=', doc.title)
        .execute()

      if (noteData.length > 0) {
        await tx.insertInto('note_data').values(noteData).execute()

        totalDataRows += noteData.length
      }

      if (noteLines.length > 0) {
        await tx.insertInto('note_lines').values(noteLines).execute()
        totalLineRows += noteLines.length
      }

      processedCount++
    }

    return {
      totalDocs: allDocs.length,
      processedDocs: processedCount,
      totalDataRows,
      totalLineRows,
    }
  })

  return results
}
