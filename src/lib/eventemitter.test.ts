import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { TypedEventEmitter, useEmitterEventListener } from './eventemitter'

// Test event types
type TestEvents = {
  userLogin: { id: string; name: string }
  userLogout: undefined
  dataUpdate: { timestamp: number; payload: any }
  errorOccurred: { message: string; code: number }
  simpleEvent: undefined
}

describe('TypedEventEmitter', () => {
  let emitter: TypedEventEmitter<TestEvents>

  beforeEach(() => {
    emitter = new TypedEventEmitter<TestEvents>()
  })

  describe('on() method', () => {
    test('should add listener and return unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = emitter.on('userLogin', listener)

      expect(typeof unsubscribe).toBe('function')
      expect(emitter.listenerCount('userLogin')).toBe(1)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      expect(listener).toHaveBeenCalledWith({ id: '123', name: 'John' })
    })

    test('should handle events with undefined data', () => {
      const listener = vi.fn()
      emitter.on('userLogout', listener)

      emitter.emit('userLogout')
      expect(listener).toHaveBeenCalledWith(undefined)
    })

    test('should allow multiple listeners for same event', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('userLogin', listener1)
      emitter.on('userLogin', listener2)

      expect(emitter.listenerCount('userLogin')).toBe(2)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      expect(listener1).toHaveBeenCalledWith({ id: '123', name: 'John' })
      expect(listener2).toHaveBeenCalledWith({ id: '123', name: 'John' })
    })

    test('should unsubscribe listener when calling returned function', () => {
      const listener = vi.fn()
      const unsubscribe = emitter.on('userLogin', listener)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
      expect(emitter.listenerCount('userLogin')).toBe(0)

      emitter.emit('userLogin', { id: '456', name: 'Jane' })
      expect(listener).toHaveBeenCalledTimes(1) // Should not be called again
    })

    test('should clean up empty listener sets when unsubscribing', () => {
      const listener = vi.fn()
      const unsubscribe = emitter.on('userLogin', listener)

      expect(emitter.listenerCount('userLogin')).toBe(1)
      unsubscribe()
      expect(emitter.listenerCount('userLogin')).toBe(0)
    })
  })

  describe('off() method', () => {
    test('should remove specific listener', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('userLogin', listener1)
      emitter.on('userLogin', listener2)
      expect(emitter.listenerCount('userLogin')).toBe(2)

      emitter.off('userLogin', listener1)
      expect(emitter.listenerCount('userLogin')).toBe(1)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).toHaveBeenCalledWith({ id: '123', name: 'John' })
    })

    test('should handle removing non-existent listener', () => {
      const listener = vi.fn()

      // Try to remove listener that was never added
      expect(() => emitter.off('userLogin', listener)).not.toThrow()
      expect(emitter.listenerCount('userLogin')).toBe(0)
    })

    test('should clean up empty listener sets', () => {
      const listener = vi.fn()
      emitter.on('userLogin', listener)

      emitter.off('userLogin', listener)
      expect(emitter.listenerCount('userLogin')).toBe(0)
    })
  })

  describe('emit() method', () => {
    test('should call all listeners with correct data', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('dataUpdate', listener1)
      emitter.on('dataUpdate', listener2)

      const data = { timestamp: Date.now(), payload: { test: 'data' } }
      emitter.emit('dataUpdate', data)

      expect(listener1).toHaveBeenCalledWith(data)
      expect(listener2).toHaveBeenCalledWith(data)
    })

    test('should handle emitting to non-existent event', () => {
      expect(() =>
        emitter.emit('userLogin', { id: '123', name: 'John' })
      ).not.toThrow()
    })

    test('should not affect other event listeners', () => {
      const loginListener = vi.fn()
      const logoutListener = vi.fn()

      emitter.on('userLogin', loginListener)
      emitter.on('userLogout', logoutListener)

      emitter.emit('userLogin', { id: '123', name: 'John' })

      expect(loginListener).toHaveBeenCalledWith({ id: '123', name: 'John' })
      expect(logoutListener).not.toHaveBeenCalled()
    })
  })

  describe('listenerCount() method', () => {
    test('should return correct count', () => {
      expect(emitter.listenerCount('userLogin')).toBe(0)

      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('userLogin', listener1)
      expect(emitter.listenerCount('userLogin')).toBe(1)

      emitter.on('userLogin', listener2)
      expect(emitter.listenerCount('userLogin')).toBe(2)

      emitter.off('userLogin', listener1)
      expect(emitter.listenerCount('userLogin')).toBe(1)
    })
  })
})

describe('React Hooks', () => {
  describe('useEventListener', () => {
    test('should subscribe to events and clean up on unmount', () => {
      const emitter = new TypedEventEmitter<TestEvents>()
      const handler = vi.fn()

      const { unmount } = renderHook(() =>
        useEmitterEventListener(emitter, 'userLogin', handler)
      )

      expect(emitter.listenerCount('userLogin')).toBe(1)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      expect(handler).toHaveBeenCalledWith({ id: '123', name: 'John' })

      unmount()
      expect(emitter.listenerCount('userLogin')).toBe(0)
    })

    test('should handle handler changes without re-subscribing', () => {
      const emitter = new TypedEventEmitter<TestEvents>()
      let handler = vi.fn()

      const { rerender } = renderHook(
        ({ currentHandler }) =>
          useEmitterEventListener(emitter, 'userLogin', currentHandler),
        { initialProps: { currentHandler: handler } }
      )

      expect(emitter.listenerCount('userLogin')).toBe(1)

      // Change handler
      const newHandler = vi.fn()
      handler = newHandler
      rerender({ currentHandler: newHandler })

      // Should still have only one listener
      expect(emitter.listenerCount('userLogin')).toBe(1)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      expect(newHandler).toHaveBeenCalledWith({ id: '123', name: 'John' })
    })

    test('should re-subscribe when emitter or event changes', () => {
      const emitter1 = new TypedEventEmitter<TestEvents>()
      const emitter2 = new TypedEventEmitter<TestEvents>()
      const handler = vi.fn()

      const { rerender } = renderHook(
        ({
          emitter,
          event,
        }: {
          emitter: TypedEventEmitter<TestEvents>
          event: keyof TestEvents
        }) => useEmitterEventListener(emitter, event as any, handler),
        {
          initialProps: {
            emitter: emitter1,
            event: 'userLogin' as keyof TestEvents,
          },
        }
      )

      expect(emitter1.listenerCount('userLogin')).toBe(1)
      expect(emitter2.listenerCount('userLogin')).toBe(0)

      // Change emitter
      rerender({ emitter: emitter2, event: 'userLogin' as keyof TestEvents })

      expect(emitter1.listenerCount('userLogin')).toBe(0)
      expect(emitter2.listenerCount('userLogin')).toBe(1)

      // Change event
      rerender({ emitter: emitter2, event: 'userLogout' as keyof TestEvents })

      expect(emitter2.listenerCount('userLogin')).toBe(0)
      expect(emitter2.listenerCount('userLogout')).toBe(1)
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  test('should handle rapid subscribe/unsubscribe cycles', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    const listener = vi.fn()

    for (let i = 0; i < 100; i++) {
      const unsubscribe = emitter.on('userLogin', listener)
      unsubscribe()
    }

    expect(emitter.listenerCount('userLogin')).toBe(0)
    emitter.emit('userLogin', { id: '123', name: 'John' })
    expect(listener).not.toHaveBeenCalled()
  })

  test('should handle double unsubscribe gracefully', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    const listener = vi.fn()

    const unsubscribe = emitter.on('userLogin', listener)
    unsubscribe()

    expect(() => unsubscribe()).not.toThrow()
    expect(emitter.listenerCount('userLogin')).toBe(0)
  })

  test('should handle emitting events during listener execution', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    const listener1 = vi.fn()
    const listener2 = vi.fn(() => {
      // Emit another event during listener execution
      emitter.emit('userLogout')
    })

    emitter.on('userLogin', listener1)
    emitter.on('userLogin', listener2)
    emitter.on('userLogout', listener1)

    emitter.emit('userLogin', { id: '123', name: 'John' })

    expect(listener1).toHaveBeenCalledTimes(2) // Once for login, once for logout
    expect(listener2).toHaveBeenCalledTimes(1)
  })

  test('should maintain correct listener count during complex operations', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    const listeners = Array.from({ length: 5 }, () => vi.fn())

    // Add multiple listeners
    const unsubscribeFunctions = listeners.map((listener) =>
      emitter.on('userLogin', listener)
    )

    expect(emitter.listenerCount('userLogin')).toBe(5)

    // Remove some listeners
    unsubscribeFunctions[1]()
    unsubscribeFunctions[3]()

    expect(emitter.listenerCount('userLogin')).toBe(3)

    // Add more listeners
    emitter.on('userLogin', vi.fn())

    expect(emitter.listenerCount('userLogin')).toBe(4)
  })
})
