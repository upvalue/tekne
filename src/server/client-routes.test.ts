// @vitest-environment node
import { expect, test, vi } from 'vitest'
import type { Express, RequestHandler } from 'express'
import express from 'express'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { registerClientRoutes } from './client-routes'

test('registers every client route and serves the same SPA entry point', () => {
  const get = vi.fn<(route: string, handler: RequestHandler) => void>()
  registerClientRoutes({ get } as unknown as Express, '/app/dist')

  expect(get.mock.calls.map(([route]) => route)).toEqual([
    '/',
    '/404',
    '/demo',
    '/dev-settings',
    '/lab',
    '/doc-not-found/:title',
    '/n/:title',
    '/open/:title',
  ])

  for (const [, handler] of get.mock.calls) {
    const sendFile = vi.fn()
    handler({} as never, { sendFile } as never, vi.fn())
    expect(sendFile).toHaveBeenCalledExactlyOnceWith('/app/dist/index.html')
  }
})

test('serves client routes over HTTP and leaves unknown paths unmatched', async () => {
  const distPath = await mkdtemp(path.join(tmpdir(), 'tekne-routes-'))
  const html = '<!doctype html><title>Tekne route test</title>'
  await writeFile(path.join(distPath, 'index.html'), html)
  const app = express()
  registerClientRoutes(app, distPath)
  app.use((_req, res) => res.sendStatus(404))
  const server = app.listen(0, '127.0.0.1')

  try {
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No test port')
    const base = `http://127.0.0.1:${address.port}`
    for (const route of [
      '/',
      '/404',
      '/demo',
      '/dev-settings',
      '/lab',
      '/doc-not-found/Missing',
      '/n/Project%20%2F%20notes%20%26%20%5Btest%5D?view=outline',
      '/open/%24Template',
    ]) {
      const response = await fetch(base + route)
      expect(response.status, route).toBe(200)
      expect(response.headers.get('content-type'), route).toContain('text/html')
      expect(await response.text(), route).toBe(html)
    }
    for (const route of ['/unknown', '/n', '/n/one/two', '/api/missing']) {
      expect((await fetch(base + route)).status, route).toBe(404)
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    await rm(distPath, { recursive: true, force: true })
  }
})
