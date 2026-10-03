// @vitest-environment node
import { expect, test, vi } from 'vitest'
import type { Express, RequestHandler } from 'express'
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
