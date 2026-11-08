import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from '@/api/router'
import { inputs } from '@/api/inputs'
import { runTool, toolResult } from './results'

type Api = RouterClient<AppRouter>
export type TekneApi = {
  doc: Pick<
    Api['doc'],
    | 'searchDocs'
    | 'loadDoc'
    | 'listTemplates'
    | 'createDoc'
    | 'createDocFromTemplate'
    | 'editDoc'
  >
  search: Pick<Api['search'], 'query'>
  tags: Pick<Api['tags'], 'list'>
  timers: Pick<Api['timers'], 'status'>
}
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

export function registerTools(server: McpServer, api: TekneApi) {
  server.registerTool(
    'search',
    {
      description:
        'Search entries and summarize all matches. Supports text, #tags, doc globs, status, has, and dates; pass timezone for local dates. nextCursor paginates results.',
      inputSchema: inputs.search.query,
      annotations: readOnly,
    },
    (input) => runTool(async () => toolResult(await api.search.query(input)))
  )
  server.registerTool(
    'list_documents',
    {
      description:
        'Find documents by title substring. Empty query lists all titles.',
      inputSchema: inputs.doc.searchDocs,
      annotations: readOnly,
    },
    (input) =>
      runTool(async () =>
        toolResult({ items: await api.doc.searchDocs(input) })
      )
  )
  server.registerTool(
    'read_document',
    {
      description:
        'Read the exact document title, full outline, stable line IDs, metadata, and revision. Read before editing. Results over 512 KiB require the HTTP API.',
      inputSchema: inputs.doc.loadDoc,
      annotations: readOnly,
    },
    (input) => runTool(async () => toolResult(await api.doc.loadDoc(input)))
  )
  server.registerTool(
    'list_tags',
    {
      description: 'List tags, descriptions, archive state, and usage counts.',
      inputSchema: inputs.empty,
      annotations: readOnly,
    },
    (input) =>
      runTool(async () => toolResult({ items: await api.tags.list(input) }))
  )
  server.registerTool(
    'list_templates',
    {
      description:
        'List template document names. Read a template with read_document.',
      inputSchema: inputs.empty,
      annotations: readOnly,
    },
    (input) =>
      runTool(async () =>
        toolResult({ items: await api.doc.listTemplates(input) })
      )
  )
  server.registerTool(
    'timer_status',
    {
      description:
        'Read current persisted timers and surrounding outline context. Does not advance or save timers.',
      inputSchema: inputs.empty,
      annotations: readOnly,
    },
    (input) => runTool(async () => toolResult(await api.timers.status(input)))
  )
  server.registerTool(
    'create_document',
    {
      description:
        'Create a document, optionally from templateName, then read its content. Daily names may apply $Daily. Existing names fail; after a lost response read the title before retrying.',
      inputSchema: inputs.doc.createDoc.extend({
        templateName:
          inputs.doc.createDocFromTemplate.shape.templateName.optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (input) =>
      runTool(async () => {
        const created =
          input.templateName === undefined
            ? await api.doc.createDoc({ name: input.name })
            : await api.doc.createDocFromTemplate({
                name: input.name,
                templateName: input.templateName,
              })
        try {
          const result = toolResult({
            ...created,
            ...(await api.doc.loadDoc({ name: input.name })),
          })
          if (!result.isError) return result
        } catch {
          // Creation is already committed; a failed follow-up read must not invite another create.
        }
        return toolResult({
          ...created,
          contentAvailable: false,
          message:
            'Document created. Follow-up read failed or exceeded the size limit. Read the existing document; do not repeat creation.',
        })
      })
  )
  server.registerTool(
    'edit_document',
    {
      description:
        'Apply an atomic batch of field updates, insertions, deletions, or moves at expectedRevision. Omitted fields are preserved; null clears metadata. Delete/move require explicit line or subtree scope. Retry lost responses with the same UUID requestId and payload.',
      inputSchema: inputs.doc.editDoc,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (input) =>
      runTool(async () => {
        const result = await api.doc.editDoc(input)
        if (result.status === 'ok') return toolResult(result)
        const conflict = toolResult(
          {
            ...result,
            message:
              'Nothing was written. Reconcile against serverDoc and retry with a new request ID.',
          },
          true
        )
        if (conflict.structuredContent?.code !== 'RESULT_TOO_LARGE')
          return conflict
        return toolResult(
          {
            status: 'conflict',
            serverRevision: result.serverRevision,
            serverDocOmitted: true,
            message:
              'Nothing was written. Current document exceeds 512 KiB; read it through the HTTP API before reconciling.',
          },
          true
        )
      })
  )
}
