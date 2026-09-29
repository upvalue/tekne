import type { Express } from 'express'
import { onError } from '@orpc/server'
import { RPCHandler, BodyLimitPlugin } from '@orpc/server/node'
import { OpenAPIHandler } from '@orpc/openapi/node'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import type { Kysely } from 'kysely'
import type { Database } from '@/db'
import { apiReference } from './api-reference'
import { appRouter } from '@/api/router'

export const generateOpenAPI = () =>
  new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  }).generate(appRouter, {
    info: {
      title: 'Tekne API',
      version: '1.0.0',
      description:
        'Plain JSON API for documents, tags, searches, tasks and maintenance. Access uses the same trusted network as the app; there is no separate API token. Dates are ISO 8601 strings. See /api for curl examples and usage notes.',
    },
    servers: [{ url: '/api/v1' }],
  })

export const registerApi = async (app: Express, db: Kysely<Database>) => {
  const spec = await generateOpenAPI()
  const reference = apiReference(spec)
  app.get(['/api', '/api/'], (_req, res) => res.type('html').send(reference))
  app.get('/api/openapi.json', (_req, res) => res.json(spec))
  const options = () => ({
    plugins: [new BodyLimitPlugin({ maxBodySize: 10 * 1024 * 1024 })],
  })
  const openapi = new OpenAPIHandler(appRouter, {
    ...options(),
    interceptors: [
      onError((error) => console.error('OpenAPI request failed', error)),
    ],
  })
  const rpc = new RPCHandler(appRouter, {
    ...options(),
    interceptors: [
      onError((error) => console.error('RPC request failed', error)),
    ],
  })
  // Keep the original URL intact so the handlers can match their prefixes.
  // Register before Express body parsing; oRPC reads and limits the stream.
  app.use(async (req, res, next) => {
    const handler = req.path.startsWith('/api/v1/')
      ? openapi
      : req.path.startsWith('/api/rpc/')
        ? rpc
        : undefined
    if (!handler) return next()
    const prefix = handler === openapi ? '/api/v1' : '/api/rpc'
    const { matched } = await handler.handle(req, res, {
      prefix,
      context: { db },
    })
    if (!matched) next()
  })
}
