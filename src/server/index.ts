import express, { type Request, type Response } from 'express'
import morgan from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import * as trpcExpress from '@trpc/server/adapters/express'
import { appRouter } from '@/trpc'
import { dbServer } from '@/db'
import { sql } from 'kysely'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerClientRoutes } from './client-routes.js'

import dotenv from 'dotenv'

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' })
} else {
  dotenv.config()
}

const app = express()
const PORT = process.env.PORT || 3005
const NODE_ENV = process.env.NODE_ENV || 'development'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_PATH = path.join(__dirname, '../../dist')

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Unsafe-inline currently required for codemirror event handlers
        // Can probably be fixed
        'script-src': ["'self'"],
        'script-src-attr': ["'unsafe-inline'"],
      },
    },
  })
)
app.use(cors())
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logging middleware
if (NODE_ENV === 'production') {
  app.use(morgan('combined'))
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => {
          console.log(message.trim())
        },
      },
    })
  )
}

// Serve static assets in production
if (NODE_ENV === 'production') {
  app.use(
    express.static(DIST_PATH, {
      maxAge: '1y',
      etag: true,
      setHeaders: (res, filePath) => {
        // Cache static assets for 1 year, except HTML files
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    })
  )
}

const db = await dbServer()

const createContext = async ({ req, res }: { req: Request; res: Response }) => {
  return { db, req, res }
}

app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path, type }) => {
      console.error(`TRPC Error on ${type} ${path}:`, {
        message: error.message,
        code: error.code,
        cause: error.cause,
        stack: error.stack,
      })
    },
  })
)

app.get('/api/healthcheck', async (_req: Request, res: Response) => {
  const db = await dbServer()
  await db
    .selectFrom(sql`(select 1)`.as('subquery'))
    .selectAll()
    .execute()

  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Register client routes in production
registerClientRoutes(app, DIST_PATH)

// Catch-all for unmatched routes
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' })
  }

  const message =
    NODE_ENV === 'production'
      ? 'Route not found'
      : 'Route not found - development mode'

  res.status(404).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

export default app
