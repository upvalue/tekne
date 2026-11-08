import express, { type Express } from 'express'
import { createRouterClient } from '@orpc/server'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Kysely } from 'kysely'
import type { Database } from '@/db'
import { appRouter } from '@/api/router'
import { createTekneMcpServer } from '@/mcp/server'

export type McpAccess = { allowedHosts: string[]; allowedOrigins: string[] }

export function registerMcp(
  app: Express,
  db: Kysely<Database>,
  access: McpAccess
) {
  const api = createRouterClient(appRouter, { context: { db } })
  app.all('/mcp', (req, res, next) => {
    // Compare the supplied authority exactly, including port. Forwarded headers are not trusted.
    if (
      !req.headers.host ||
      !access.allowedHosts.includes(req.headers.host) ||
      (req.headers.origin !== undefined &&
        !access.allowedOrigins.includes(req.headers.origin))
    ) {
      res.status(403).json({ error: 'MCP host or origin is not allowed' })
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      res.status(405).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Method not allowed' },
      })
      return
    }
    next()
  })
  app.post('/mcp', express.json({ limit: '1mb' }), async (req, res) => {
    const server = createTekneMcpServer(api)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    res.once('close', () => {
      void server
        .close()
        .catch((error) => console.error('MCP close failed', error))
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      console.error('MCP transport failed', error)
      await server.close()
      if (!res.headersSent)
        res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: 'Internal server error' },
        })
    }
  })
}
