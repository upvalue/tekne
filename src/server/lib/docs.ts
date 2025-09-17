import type { Database } from '@/db'
import type { Kysely } from 'kysely'
import type { ZDoc } from '@/docs/schema'
import { extractDocData, treeifyDoc } from '@/docs/doc-analysis'

const linesToZodDoc = (title: string, children: Array<any>): ZDoc => {
  return {
    type: 'doc',
    children,
    schemaVersion: 1,
  }
}

/**
 * Process a document and return the derived data for database insertion
 */
export const processDocumentForData = (title: string, doc: ZDoc) => {
  // Analyze doc to get data
  const tree = treeifyDoc(linesToZodDoc(title, doc.children))
  const data = extractDocData(tree.children)

  return data.map((d) => ({
    note_title: title,
    line_idx: d.lineIdx,
    time_created: new Date(d.timeCreated),
    time_updated: new Date(d.timeUpdated),
    datum_tag: d.datumTag,
    datum_status: d.datumStatus,
    datum_time_seconds: d.datumTimeSeconds,
    datum_type: d.datumType,
  }))
}

/**
 * Recompute all document data across all documents in the database
 * This does NOT alter document records themselves, only derived data
 */
export const recomputeAllDocumentData = async (db: Kysely<Database>) => {
  const results = await db.transaction().execute(async (tx) => {
    // Get all documents
    const allDocs = await tx.selectFrom('notes').selectAll().execute()
    
    // Clear all existing note_data
    await tx.deleteFrom('note_data').execute()
    
    let processedCount = 0
    let totalDataRows = 0
    
    // Process each document
    for (const doc of allDocs) {
      const processedData = processDocumentForData(doc.title, doc.body)
      
      if (processedData.length > 0) {
        await tx
          .insertInto('note_data')
          .values(processedData)
          .execute()
        
        totalDataRows += processedData.length
      }
      
      processedCount++
    }
    
    return {
      totalDocs: allDocs.length,
      processedDocs: processedCount,
      totalDataRows,
    }
  })
  
  return results
}