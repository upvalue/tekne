import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { isApple } from '@/lib/platform'
import { useGlobalKeybinding } from './useGlobalKeybinding'

const openKey = (options: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', {
    key: 'o',
    ...(isApple ? { metaKey: true } : { ctrlKey: true }),
    cancelable: true,
    ...options,
  })

describe('document-open shortcuts', () => {
  test('handles both shortcuts and cancels the browser action', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() =>
      useGlobalKeybinding('documentSearch', handler)
    )
    for (const shiftKey of [false, true]) {
      const event = openKey({ shiftKey })
      act(() => {
        window.dispatchEvent(event)
      })
      expect(event.defaultPrevented).toBe(true)
    }
    expect(handler).toHaveBeenCalledTimes(2)
    unmount()
    act(() => {
      window.dispatchEvent(openKey())
    })
    expect(handler).toHaveBeenCalledTimes(2)
  })

  test('does not open the picker for an uncancelable browser shortcut', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() =>
      useGlobalKeybinding('documentSearch', handler)
    )
    act(() => {
      window.dispatchEvent(openKey({ cancelable: false }))
    })
    expect(handler).not.toHaveBeenCalled()
    unmount()
  })
})
