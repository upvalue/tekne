import { describe, test, expect, vi } from 'vitest'

// The module wires a matchMedia listener at import time, so each test stubs
// matchMedia first and imports a fresh copy.
const importWithViewport = async (matches: boolean) => {
  let listener: ((e: { matches: boolean }) => void) | undefined
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listener = cb
      },
    })
  )
  vi.resetModules()
  const mod = await import('./panel-state')
  return { ...mod, resize: (matches: boolean) => listener?.({ matches }) }
}

describe('panelVisibleAtom', () => {
  test('defaults to the viewport width and tracks resizes', async () => {
    const { panelVisibleAtom, uiStore, resize } = await importWithViewport(true)
    expect(uiStore.get(panelVisibleAtom)).toBe(true)
    resize(false)
    expect(uiStore.get(panelVisibleAtom)).toBe(false)
    resize(true)
    expect(uiStore.get(panelVisibleAtom)).toBe(true)
  })

  test('an explicit choice wins over later resizes', async () => {
    const { panelVisibleAtom, uiStore, resize } =
      await importWithViewport(false)
    uiStore.set(panelVisibleAtom, true)
    resize(true)
    resize(false)
    expect(uiStore.get(panelVisibleAtom)).toBe(true)
  })

  test('supports updater functions', async () => {
    const { panelVisibleAtom, uiStore } = await importWithViewport(true)
    uiStore.set(panelVisibleAtom, (v: boolean) => !v)
    expect(uiStore.get(panelVisibleAtom)).toBe(false)
  })
})
