import { z } from 'zod'
import { zdoc, zline } from '@/docs/schema'

const success = z.object({ success: z.boolean() })
const namedSuccess = success.extend({ name: z.string() })
const count = z.number()
const aggregate = z.object({
  tag: z.string(),
  complete_tasks: count,
  incomplete_tasks: count,
  unset_tasks: count,
  total_time_seconds: count,
  pinned_at: z.date().nullable(),
  pinned_desc: z.string().nullable(),
  page_complete_tasks: count.optional(),
  page_incomplete_tasks: count.optional(),
  page_unset_tasks: count.optional(),
  page_time_seconds: count.optional(),
})
const migrationReport = z.object({
  documentTitle: z.string(),
  originalVersion: z.number().optional(),
  targetVersion: z.number(),
  operations: z.array(
    z.object({
      type: z.enum(['rename', 'delete', 'add', 'update']),
      path: z.string(),
      oldValue: z.unknown().optional(),
      newValue: z.unknown().optional(),
      description: z.string(),
    })
  ),
  migrated: z.boolean(),
})
const savedSearch = z.object({
  id: z.number(),
  name: z.string(),
  query: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
})
const diffLine = zline.pick({
  mdContent: true,
  indent: true,
  datumTaskStatus: true,
  datumTimeSeconds: true,
  datumPinnedAt: true,
})
const change = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('changed'), before: diffLine, after: diffLine }),
  z.object({ kind: z.literal('inserted'), after: diffLine }),
  z.object({ kind: z.literal('deleted'), before: diffLine }),
])

export const outputs = {
  doc: {
    searchDocs: z.array(
      z.object({ id: z.string(), title: z.string(), subtitle: z.string() })
    ),
    loadDoc: z.object({ doc: zdoc, revision: count }),
    loadDocDetails: z.object({
      createdAt: z.date(),
      updatedAt: z.date(),
      revision: count,
    }),
    updateDoc: z.discriminatedUnion('status', [
      z.object({ status: z.literal('ok'), revision: count }),
      z.object({
        status: z.literal('conflict'),
        serverDoc: zdoc,
        serverRevision: count,
      }),
    ]),
    renameDocPropose: z.object({
      docAlreadyExists: z.boolean(),
      linksToUpdate: z.array(z.object({ title: z.string() })),
    }),
    renameDocExecute: success.extend({
      newName: z.string(),
      linksUpdated: count,
    }),
    createDoc: namedSuccess,
    deleteDoc: namedSuccess,
    listTemplates: z.array(z.string()),
    createDocFromTemplate: namedSuccess,
    validateAllDocs: z.object({
      summary: z.object({
        totalDocs: count,
        validDocs: count,
        invalidDocs: count,
        fixableByMigration: count,
        unfixable: count,
      }),
      results: z.array(
        z.object({
          title: z.string(),
          valid: z.boolean(),
          errors: z.array(z.string()),
          warnings: z.array(z.string()),
          extraFields: z.array(z.string()),
          canBeFxedByMigration: z.boolean().optional(),
          migrationReport: migrationReport.optional(),
        })
      ),
    }),
    migrateAllDocs: z.object({
      summary: z.object({
        totalDocs: count,
        migratedDocs: count,
        unchangedDocs: count,
      }),
      reports: z.array(migrationReport),
    }),
    recomputeAllData: z.object({
      totalDocs: count,
      processedDocs: count,
      totalDataRows: count,
      totalLineRows: count,
    }),
  },
  analysis: { aggregateData: z.array(aggregate) },
  search: {
    searchLines: z.object({
      items: z.array(
        z.object({
          note_title: z.string(),
          line_idx: count,
          time_created: z.date().nullable(),
          tags: z.array(z.string()),
          content: z.string(),
          indent: count,
          datum_task_status: zline.shape.datumTaskStatus.unwrap().nullable(),
          datum_time_seconds: count.nullable(),
          datum_pinned_at: z.string().nullable(),
          child_count: count,
        })
      ),
      nextCursor: count.optional(),
    }),
    searchAggregate: z.array(aggregate),
    getSavedSearches: z.array(savedSearch),
    saveSearch: savedSearch,
    deleteSavedSearch: success,
  },
  flags: { getAll: z.record(z.string(), z.unknown()), set: success },
  tags: {
    list: z.array(
      z.object({
        name: z.string(),
        description: z.string().nullable(),
        archived: z.boolean(),
        lineCount: count,
        docCount: count,
      })
    ),
    allTags: z.array(z.string()),
    setArchived: success,
    setDescription: success,
    renamePropose: z.object({
      targetExists: z.boolean(),
      childTags: z.array(z.string()),
      renames: z.array(z.object({ from: z.string(), to: z.string() })),
      totalLines: count,
      docs: z.array(
        z.object({
          title: z.string(),
          isTemplate: z.boolean(),
          lines: z.array(
            diffLine
              .omit({ mdContent: true })
              .extend({ lineIdx: count, before: z.string(), after: z.string() })
          ),
        })
      ),
    }),
    renameExecute: success.extend({ docsUpdated: count, linesUpdated: count }),
  },
  tasks: {
    cancelStalePropose: z.object({
      documents: z.array(
        z.object({
          title: z.string(),
          revision: count,
          isTemplate: z.boolean(),
          changes: z.array(change),
        })
      ),
      totalChanges: count,
    }),
    cancelStaleExecute: success.extend({
      tasksUpdated: count,
      documentsUpdated: count,
    }),
  },
}
