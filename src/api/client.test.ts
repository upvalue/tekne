import { afterEach, expect, test, vi } from 'vitest'

vi.mock('@/db', () => ({ dbHandle: vi.fn(async () => ({})) }))
vi.mock('./router', async () => {
  const { os } = await import('@orpc/server')
  return {
    appRouter: { flags: { getAll: os.handler(() => ({ local: true })) } },
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

test.each([true, false])(
  'demo uses the local router with PROD=%s',
  async (prod) => {
    vi.stubEnv('PROD', prod)
    vi.stubEnv('TEKNE_DEMO', 'true')
    vi.stubEnv('TEKNE_ORPC_URL', 'https://example.com/api/rpc')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const { orpcClient } = await import('./client')
    expect(await orpcClient.flags.getAll()).toEqual({ local: true })
    expect(fetch).not.toHaveBeenCalled()
  }
)

test('server-backed production uses HTTP RPC', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('TEKNE_DEMO', '')
  vi.stubEnv('TEKNE_ORPC_URL', '')
  const fetch = vi.fn(async () => new Response('{"json":{}}'))
  vi.stubGlobal('fetch', fetch)

  const { orpcClient } = await import('./client')
  await orpcClient.flags.getAll()
  expect(fetch).toHaveBeenCalledOnce()
})
