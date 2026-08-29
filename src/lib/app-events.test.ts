import { describe, expect, test } from 'vitest'
import { requestEditorFlush } from './app-events'

describe('requestEditorFlush', () => {
  test('resolves immediately when no editor is mounted', async () => {
    await expect(requestEditorFlush()).resolves.toBeUndefined()
  })

  test('returns the promise a mounted listener attaches', async () => {
    const failure = new Error('save failed')
    const listener = (event: WindowEventMap['tekne:request-save']) => {
      event.detail.flush = Promise.reject(failure)
    }
    window.addEventListener('tekne:request-save', listener)
    try {
      await expect(requestEditorFlush()).rejects.toBe(failure)
    } finally {
      window.removeEventListener('tekne:request-save', listener)
    }
  })
})
