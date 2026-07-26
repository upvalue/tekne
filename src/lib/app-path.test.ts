import { describe, expect, it, vi } from 'vitest'

describe('application paths', () => {
  it('uses root paths when mounted at the origin root', async () => {
    vi.stubEnv('BASE_URL', '/')
    vi.resetModules()
    const { appBasePath, appPath, stripAppBasePath } = await import('./app-path')

    expect(appBasePath).toBe('')
    expect(appPath('/n/Tutorial')).toBe('/n/Tutorial')
    expect(stripAppBasePath('/n/Tutorial')).toBe('/n/Tutorial')
  })

  it('prefixes and strips a subpath mount', async () => {
    vi.stubEnv('BASE_URL', '/dev/')
    vi.resetModules()
    const { appBasePath, appPath, stripAppBasePath } = await import('./app-path')

    expect(appBasePath).toBe('/dev')
    expect(appPath('/n/Tutorial')).toBe('/dev/n/Tutorial')
    expect(stripAppBasePath('/dev/n/Tutorial')).toBe('/n/Tutorial')
    expect(stripAppBasePath('/dev')).toBe('/')
  })
})
