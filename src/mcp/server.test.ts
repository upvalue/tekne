// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ORPCError } from '@orpc/server'
import { docMake, lineMake } from '@/docs/schema'
import { createTekneMcpServer } from './server'
import { MAX_RESULT_BYTES } from './results'
import type { TekneApi } from './tools'

const unused = () => {
  throw new Error('Unexpected API call')
}
const fakeApi = (): TekneApi => ({
  doc: {
    searchDocs: unused,
    loadDoc: unused,
    listTemplates: unused,
    createDoc: unused,
    createDocFromTemplate: unused,
    editDoc: unused,
  },
  search: { query: unused },
  tags: { list: unused },
  timers: { status: unused },
})

async function withClient(
  api: TekneApi,
  run: (client: Client) => Promise<void>
) {
  const server = createTekneMcpServer(api)
  const client = new Client({ name: 'adapter-test', version: '1' })
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    await run(client)
  } finally {
    await client.close()
    await server.close()
  }
}

test('creation reports a committed write when its follow-up read fails', async () => {
  const api = fakeApi()
  const create = vi.fn(async () => ({ success: true, name: 'Created' }))
  api.doc.createDoc = create
  api.doc.loadDoc = async () => {
    throw new ORPCError('NOT_FOUND')
  }
  await withClient(api, async (client) => {
    expect(
      await client.callTool({
        name: 'create_document',
        arguments: { name: 'Created' },
      })
    ).toMatchObject({
      structuredContent: {
        success: true,
        name: 'Created',
        contentAvailable: false,
      },
    })
    expect(create).toHaveBeenCalledExactlyOnceWith({ name: 'Created' })
  })
})

test('template creation composes the template and read procedures', async () => {
  const api = fakeApi()
  const create = vi.fn(async () => ({ success: true, name: 'Created' }))
  api.doc.createDocFromTemplate = create
  api.doc.loadDoc = async () => ({ doc: docMake([]), revision: 0 })
  await withClient(api, async (client) => {
    const result = await client.callTool({
      name: 'create_document',
      arguments: { name: 'Created', templateName: '$Work' },
    })
    expect(result.structuredContent).toMatchObject({
      name: 'Created',
      revision: 0,
    })
    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: 'Created',
      templateName: '$Work',
    })
  })
})

test('large reads fail explicitly and large conflicts retain their revision and no-write outcome', async () => {
  const api = fakeApi()
  const doc = docMake([lineMake(0, 'x'.repeat(MAX_RESULT_BYTES))])
  api.doc.loadDoc = async () => ({ doc, revision: 5 })
  api.doc.editDoc = async () => ({
    status: 'conflict',
    serverDoc: doc,
    serverRevision: 5,
  })
  await withClient(api, async (client) => {
    expect(
      await client.callTool({
        name: 'read_document',
        arguments: { name: 'Large' },
      })
    ).toMatchObject({
      isError: true,
      structuredContent: { code: 'RESULT_TOO_LARGE' },
    })
    expect(
      await client.callTool({
        name: 'edit_document',
        arguments: {
          name: 'Large',
          expectedRevision: 4,
          requestId: crypto.randomUUID(),
          operations: [
            {
              op: 'update',
              id: doc.children[0].id,
              changes: { mdContent: 'Changed' },
            },
          ],
        },
      })
    ).toMatchObject({
      isError: true,
      structuredContent: {
        status: 'conflict',
        serverRevision: 5,
        serverDocOmitted: true,
      },
    })
  })
})

test('document reads preserve legacy fields', async () => {
  const api = fakeApi()
  const doc = { ...docMake([]), legacyField: 'preserved' }
  api.doc.loadDoc = async () => ({ doc, revision: 1 })
  await withClient(api, async (client) => {
    expect(
      await client.callTool({
        name: 'read_document',
        arguments: { name: 'Legacy' },
      })
    ).toMatchObject({
      structuredContent: { doc: { legacyField: 'preserved' } },
    })
  })
})
