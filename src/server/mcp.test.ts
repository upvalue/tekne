// @vitest-environment node
import { beforeAll, afterAll, expect, test } from 'vitest'
import express from 'express'
import { request, type Server } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from '@/api/router'
import { makeTestDb } from '@/db/testing'
import { outputs } from '@/api/outputs'
import { registerApi } from './api'
import { registerMcp } from './mcp'

let database: Awaited<ReturnType<typeof makeTestDb>>
let server: Server
let base: string
let rpc: RouterClient<AppRouter>
let client: Client

beforeAll(async () => {
  database = await makeTestDb()
  const app = express()
  const access = {
    allowedHosts: [] as string[],
    allowedOrigins: ['https://tekne.example'],
  }
  registerMcp(app, database.db, access)
  await registerApi(app, database.db)
  app.use(express.json())
  app.use((_req, res) => res.status(404).end())
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing listener')
  base = `http://127.0.0.1:${address.port}`
  access.allowedHosts.push(new URL(base).host)
  rpc = createORPCClient(new RPCLink({ url: `${base}/api/rpc` }))
  client = new Client({ name: 'tekne-test', version: '1.0.0' })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`))
  )
}, 60_000)

afterAll(async () => {
  await client?.close()
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  await database?.db.destroy()
})

const http = async (path: string, body: unknown) => {
  const response = await fetch(`${base}/api/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(response.ok).toBe(true)
  return response.json()
}

test('advertises the curated tool set and shared API schemas', async () => {
  const { tools } = await client.listTools()
  expect(tools.map((t) => t.name).sort()).toEqual(
    [
      'search',
      'list_documents',
      'read_document',
      'list_tags',
      'list_templates',
      'create_document',
      'edit_document',
      'timer_status',
    ].sort()
  )
  expect(
    tools.find((t) => t.name === 'search')?.inputSchema.properties
  ).toHaveProperty('timezone')
  expect(
    tools.find((t) => t.name === 'edit_document')?.annotations
  ).toMatchObject({ destructiveHint: true })
  expect(client.getInstructions()).toContain('Retry a lost response')
  const spec = await fetch(`${base}/api/openapi.json`).then((r) => r.json())
  expect(spec.paths['/documents/edit'].post).toBeDefined()
})

test('HTTP creation, MCP editing, oRPC reads and search totals share the same data', async () => {
  await http('/documents', { name: 'MCP integration' })
  const read = await client.callTool({
    name: 'read_document',
    arguments: { name: 'MCP integration' },
  })
  const before = outputs.doc.loadDoc.parse(read.structuredContent)
  const request = {
    name: 'MCP integration',
    expectedRevision: before.revision,
    requestId: crypto.randomUUID(),
    operations: [
      {
        op: 'update' as const,
        id: before.doc.children[0].id,
        changes: {
          mdContent: 'MCP task #mcp-integration',
          datumTaskStatus: 'complete' as const,
          datumTimeSeconds: 2100,
        },
      },
    ],
  }
  const edited = await client.callTool({
    name: 'edit_document',
    arguments: request,
  })
  expect(edited.isError).not.toBe(true)
  const result = outputs.doc.editDoc.parse(edited.structuredContent)
  expect(result).toMatchObject({ status: 'ok', revision: before.revision + 1 })
  const saved = await rpc.doc.loadDoc({ name: request.name })
  expect(saved.doc.children[0]).toMatchObject(request.operations[0].changes)
  const search = await client.callTool({
    name: 'search',
    arguments: { query: '#mcp-integration', limit: 1 },
  })
  expect(search.structuredContent).toMatchObject({
    summary: { matchedCount: 1, timeSeconds: 2100 },
    items: [{ lineId: before.doc.children[0].id }],
  })
  expect(await http('/documents/edit', request)).toEqual(result)
})

test('competing MCP and oRPC edits accept one revision and retries never insert twice', async () => {
  const created = await client.callTool({
    name: 'create_document',
    arguments: { name: 'MCP race' },
  })
  const before = outputs.doc.loadDoc.parse(created.structuredContent)
  const common = {
    name: 'MCP race',
    expectedRevision: before.revision,
    operations: [
      {
        op: 'insert' as const,
        after: before.doc.children[0].id,
        lines: [{ mdContent: 'Once', indent: 0 }],
      },
    ],
  }
  const a = { ...common, requestId: crypto.randomUUID() },
    b = { ...common, requestId: crypto.randomUUID() }
  const [mcpResult, rpcResult] = await Promise.all([
    client.callTool({ name: 'edit_document', arguments: a }),
    rpc.doc.editDoc(b),
  ])
  const first = outputs.doc.editDoc.parse(mcpResult.structuredContent)
  expect([first.status, rpcResult.status].sort()).toEqual(['conflict', 'ok'])
  expect(Boolean(mcpResult.isError)).toBe(first.status === 'conflict')
  const winner = first.status === 'ok' ? a : b
  const acknowledgement = first.status === 'ok' ? first : rpcResult
  expect(await rpc.doc.editDoc(winner)).toEqual(acknowledgement)
  const saved = await rpc.doc.loadDoc({ name: common.name })
  expect(saved.doc.children.filter((l) => l.mdContent === 'Once')).toHaveLength(
    1
  )
})

test('tool errors are explicit and malformed edits cannot write', async () => {
  expect(
    await client.callTool({
      name: 'read_document',
      arguments: { name: 'Missing' },
    })
  ).toMatchObject({ isError: true, structuredContent: { code: 'NOT_FOUND' } })
  expect(
    await client.callTool({
      name: 'edit_document',
      arguments: { name: 'MCP integration', operations: [] },
    })
  ).toMatchObject({ isError: true })
})

test('rejects untrusted hosts/origins, unsupported methods, and oversized bodies', async () => {
  expect(
    (
      await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      })
    ).status
  ).toBe(403)
  const invalidHost = await new Promise<number | undefined>(
    (resolve, reject) => {
      const req = request(
        `${base}/mcp`,
        { headers: { host: 'evil.example' } },
        (res) => {
          res.resume()
          resolve(res.statusCode)
        }
      )
      req.on('error', reject)
      req.end()
    }
  )
  expect(invalidHost).toBe(403)
  expect((await fetch(`${base}/mcp`)).status).toBe(405)
  expect((await fetch(`${base}/mcp`, { method: 'DELETE' })).status).toBe(405)
  expect(
    (
      await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ large: 'x'.repeat(1024 * 1024) }),
      })
    ).status
  ).toBe(413)
  const response = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      origin: 'https://tekne.example',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }),
  })
  expect(response.status).toBe(200)
})
