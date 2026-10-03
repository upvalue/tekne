// @vitest-environment node
import { afterAll, beforeAll, expect, test } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake } from '@/docs/schema'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from '@/api/router'
import { registerApi } from './api'

let database: Awaited<ReturnType<typeof makeTestDb>>
let server: Server
let base: string
let rpc: RouterClient<AppRouter>

beforeAll(async () => {
  database = await makeTestDb()
  const app = express()
  await registerApi(app, database.db)
  app.use((_req, res) => res.status(404).json({ error: 'API route not found' }))
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing listener')
  base = `http://127.0.0.1:${address.port}`
  rpc = createORPCClient(new RPCLink({ url: `${base}/api/rpc` }))
}, 60_000)

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  await database?.db.destroy()
})

const request = async (method: string, path: string, input?: unknown) => {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: input === undefined ? {} : { 'Content-Type': 'application/json' },
    body: input === undefined ? undefined : JSON.stringify(input),
  })
  return {
    status: response.status,
    body: response.status === 204 ? undefined : await response.json(),
  }
}

test('documents use plain JSON, preserve titles with URL punctuation, and enforce revision conflicts across transports', async () => {
  const name = 'API / punctuation & [test]'
  expect(await request('POST', '/documents', { name })).toMatchObject({
    status: 200,
    body: { name, success: true },
  })
  const loaded = await request(
    'GET',
    `/documents/content?${new URLSearchParams({ name })}`
  )
  expect(loaded).toMatchObject({
    status: 200,
    body: { revision: 0, doc: { type: 'doc' } },
  })
  const doc = docMake([
    lineMake(0, '#api-test text', {
      datumTimeSeconds: 25,
      datumTaskStatus: 'unset',
    }),
  ])
  expect(
    await request('PUT', '/documents/content', {
      name,
      doc,
      expectedRevision: 0,
    })
  ).toMatchObject({ status: 200, body: { status: 'ok', revision: 1 } })
  expect(await rpc.doc.loadDoc({ name })).toMatchObject({ revision: 1, doc })
  expect(
    await rpc.doc.updateDoc({ name, doc, expectedRevision: 0 })
  ).toMatchObject({ status: 'conflict', serverRevision: 1, serverDoc: doc })
  expect(
    await request('PUT', '/documents/content', {
      name,
      doc,
      expectedRevision: 0,
    })
  ).toMatchObject({
    status: 200,
    body: { status: 'conflict', serverRevision: 1 },
  })
  const details = await request(
    'GET',
    `/documents/details?${new URLSearchParams({ name })}`
  )
  expect(details.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect((await rpc.doc.loadDocDetails({ name })).createdAt).toBeInstanceOf(
    Date
  )
  expect(
    (
      await request('POST', '/search/lines', {
        operators: [{ type: 'tag', value: '#api-test' }],
      })
    ).body.items
  ).toHaveLength(1)
  expect(await request('DELETE', '/documents', { name })).toMatchObject({
    status: 200,
    body: { success: true },
  })
  expect(
    await request('GET', `/documents/content?${new URLSearchParams({ name })}`)
  ).toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } })
})

test('validation and application errors keep useful HTTP codes', async () => {
  expect(await request('POST', '/documents', { name: '' })).toMatchObject({
    status: 400,
    body: { code: 'BAD_REQUEST' },
  })
  expect(await request('GET', '/documents/content')).toMatchObject({
    status: 400,
    body: { code: 'BAD_REQUEST' },
  })
  expect(
    await request('POST', '/search/aggregates', {
      operators: [{ type: 'has', value: 'task' }],
    })
  ).toMatchObject({ status: 400, body: { code: 'BAD_REQUEST' } })
  const malformed = await fetch(`${base}/api/v1/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  expect(malformed.status).toBe(400)
  expect(await request('GET', '/missing')).toMatchObject({ status: 404 })
})

test('OpenAPI describes every procedure, inputs and outputs; reference is available without scripts', async () => {
  const spec = await fetch(`${base}/api/openapi.json`).then((r) => r.json())
  expect(spec.openapi).toMatch(/^3\.1\./)
  expect(spec.servers).toEqual([{ url: '/api/v1' }])
  const operations = Object.values(spec.paths).flatMap((methods) =>
    Object.entries(methods as Record<string, any>)
      .filter(([method]) =>
        /^(get|put|post|delete|options|head|patch|trace)$/.test(method)
      )
      .map(([, operation]) => operation)
  )
  expect(operations).toHaveLength(30)
  for (const operation of operations) {
    expect(operation.description).toBeTruthy()
    expect(
      operation.responses['200'] ?? operation.responses['204']
    ).toBeTruthy()
    if (operation.operationId !== 'execHook') {
      expect(
        operation.responses['200'].content['application/json'].schema
      ).toBeTruthy()
    }
  }
  expect(spec.paths['/documents/content'].get.parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'name', in: 'query', required: true }),
    ])
  )
  const reference = await fetch(`${base}/api`).then((r) => r.text())
  expect(reference).toContain('curl -sS')
  expect(reference).toContain('/api/openapi.json')
  expect(reference).toContain('href="/api/llms.txt"')
  expect(reference).toContain('href="/llms.txt"')
  expect(reference).not.toContain('<script')
  expect(spec.info.description).toContain('/api/llms.txt')
})

test('plaintext guide aliases expose every live operation without duplicating schemas', async () => {
  const response = await fetch(`${base}/api/llms.txt`)
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toMatch(
    /^text\/plain; charset=utf-8$/i
  )
  const guide = await response.text()
  const alias = await fetch(`${base}/llms.txt`)
  expect(alias.status).toBe(200)
  expect(alias.headers.get('content-type')).toBe(
    response.headers.get('content-type')
  )
  expect(await alias.text()).toBe(guide)
  const prose = guide.replace(/\s+/g, ' ')
  expect(guide).toContain('/api/openapi.json')
  expect(prose).toContain('no separate API key')
  expect(guide).toContain('expectedRevision')
  expect(prose).toContain('HTTP 200 with status "conflict"')
  expect(guide).not.toContain('/llms.txt')
  expect(guide).not.toContain('curl ')
  expect(guide).not.toContain('<html')

  const spec = await fetch(`${base}/api/openapi.json`).then((r) => r.json())
  const expected = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods as Record<string, any>)
      .filter(([method]) =>
        /^(get|put|post|delete|options|head|patch|trace)$/.test(method)
      )
      .map(
        ([method, operation]) =>
          `${method.toUpperCase()} /api/v1${path} (${operation.operationId})`
      )
  )
  const index = guide.split('## Endpoint index')[1]
  expect(index.match(/^[A-Z]+ \/api\/v1\S* \([^\n]+\)$/gm)).toEqual(expected)
  expect(expected).toHaveLength(30)
  for (const methods of Object.values(spec.paths)) {
    for (const [method, operation] of Object.entries(
      methods as Record<string, any>
    )) {
      if (/^(get|put|post|delete|options|head|patch|trace)$/.test(method)) {
        expect(index).toContain(operation.description)
      }
    }
  }
})

test('document and line reads return plain JSON without changing stored revisions', async () => {
  const name = 'Project notes'
  const doc = docMake([lineMake(0, 'Documentation #project')])
  await request('POST', '/documents', { name })
  await request('PUT', '/documents/content', {
    name,
    doc,
    expectedRevision: 0,
  })

  const documents = await request('GET', '/documents?query=project')
  expect(documents.status).toBe(200)
  expect(documents.body).toEqual(
    expect.arrayContaining([
      { id: expect.any(String), title: name, subtitle: expect.any(String) },
    ])
  )
  const lines = await request('POST', '/search/lines', {
    operators: [{ type: 'tag', value: '#project' }],
    limit: 10,
  })
  expect(lines.status).toBe(200)
  expect(lines.body.items).toEqual([
    expect.objectContaining({
      note_title: name,
      line_idx: 0,
      content: 'Documentation #project',
      tags: expect.arrayContaining(['#project']),
    }),
  ])
  expect(lines.body.nextCursor).toBeUndefined()
  expect(
    await request('GET', '/documents/content?name=Project%20notes')
  ).toMatchObject({ status: 200, body: { doc, revision: 1 } })
  await request('DELETE', '/documents', { name })
})

test('legacy documents survive reads and save conflicts without output stripping', async () => {
  const legacy = {
    type: 'doc',
    children: [
      {
        type: 'line',
        mdContent: 'old text',
        indent: 0,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    ],
    legacyField: 'keep me',
  }
  await database.db
    .insertInto('notes')
    .values({
      title: 'Legacy',
      revision: 0,
      parsed_body: [],
      body: legacy as unknown as ReturnType<typeof docMake>,
    })
    .execute()
  expect(
    (await request('GET', '/documents/content?name=Legacy')).body.doc
  ).toEqual(legacy)
  expect(await rpc.doc.loadDoc({ name: 'Legacy' })).toMatchObject({
    doc: legacy,
  })
  const result = await request('PUT', '/documents/content', {
    name: 'Legacy',
    doc: docMake([]),
    expectedRevision: 99,
  })
  expect(result.body).toMatchObject({ status: 'conflict', serverDoc: legacy })
  await request('DELETE', '/documents', { name: 'Legacy' })
})
