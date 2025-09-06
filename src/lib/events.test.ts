import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import {
  TypedEventEmitter,
  useEventEmitter,
  useCustomEventListener,
  useEvent,
} from './events'

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

  describe('once() method', () => {
    test('should call listener only once', () => {
      const listener = vi.fn()
      emitter.once('userLogin', listener)

      const userData = { id: '123', name: 'John' }
      emitter.emit('userLogin', userData)
      emitter.emit('userLogin', userData)

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(userData)
      expect(emitter.listenerCount('userLogin')).toBe(0)
    })

    test('should return unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = emitter.once('userLogin', listener)

      expect(typeof unsubscribe).toBe('function')

      // Unsubscribe before emission
      unsubscribe()
      emitter.emit('userLogin', { id: '123', name: 'John' })

      expect(listener).not.toHaveBeenCalled()
      expect(emitter.listenerCount('userLogin')).toBe(0)
    })

    test('should work with undefined events', () => {
      const listener = vi.fn()
      emitter.once('userLogout', listener)

      emitter.emit('userLogout')
      emitter.emit('userLogout')

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(undefined)
    })
  })

  describe('removeAllListeners() method', () => {
    test('should remove all listeners for specific event', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const logoutListener = vi.fn()

      emitter.on('userLogin', listener1)
      emitter.on('userLogin', listener2)
      emitter.on('userLogout', logoutListener)

      expect(emitter.listenerCount('userLogin')).toBe(2)
      expect(emitter.listenerCount('userLogout')).toBe(1)

      emitter.removeAllListeners('userLogin')

      expect(emitter.listenerCount('userLogin')).toBe(0)
      expect(emitter.listenerCount('userLogout')).toBe(1)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      emitter.emit('userLogout')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
      expect(logoutListener).toHaveBeenCalled()
    })

    test('should remove all listeners for all events when no event specified', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      emitter.on('userLogin', listener1)
      emitter.on('userLogout', listener2)

      expect(emitter.listenerCount('userLogin')).toBe(1)
      expect(emitter.listenerCount('userLogout')).toBe(1)

      emitter.removeAllListeners()

      expect(emitter.listenerCount('userLogin')).toBe(0)
      expect(emitter.listenerCount('userLogout')).toBe(0)

      emitter.emit('userLogin', { id: '123', name: 'John' })
      emitter.emit('userLogout')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
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
  describe('useEventEmitter', () => {
    test('should create and maintain stable emitter instance', () => {
      const { result, rerender } = renderHook(() =>
        useEventEmitter<TestEvents>()
      )

      const emitter1 = result.current
      expect(emitter1).toBeInstanceOf(TypedEventEmitter)

      // Re-render should return same instance
      rerender()
      const emitter2 = result.current
      expect(emitter2).toBe(emitter1)
    })

    test('should create separate instances for different hook calls', () => {
      const { result: result1 } = renderHook(() =>
        useEventEmitter<TestEvents>()
      )
      const { result: result2 } = renderHook(() =>
        useEventEmitter<TestEvents>()
      )

      expect(result1.current).not.toBe(result2.current)
    })
  })

  describe('useEventListener', () => {
    test('should subscribe to events and clean up on unmount', () => {
      const emitter = new TypedEventEmitter<TestEvents>()
      const handler = vi.fn()

      const { unmount } = renderHook(() =>
        useCustomEventListener(emitter, 'userLogin', handler)
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
          useCustomEventListener(emitter, 'userLogin', currentHandler),
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
        }) => useCustomEventListener(emitter, event as any, handler),
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

  describe('useEvent', () => {
    test('should return stable emit function', () => {
      const emitter = new TypedEventEmitter<TestEvents>()
      const listener = vi.fn()
      emitter.on('userLogin', listener)

      const { result, rerender } = renderHook(() =>
        useEvent(emitter, 'userLogin')
      )

      const emitFunction1 = result.current
      expect(typeof emitFunction1).toBe('function')

      // Test the function works
      emitFunction1({ id: '123', name: 'John' })
      expect(listener).toHaveBeenCalledWith({ id: '123', name: 'John' })

      // Re-render should return same function reference
      rerender()
      const emitFunction2 = result.current
      expect(emitFunction2).toBe(emitFunction1)
    })

    test('should handle events with undefined data', () => {
      const emitter = new TypedEventEmitter<TestEvents>()
      const listener = vi.fn()
      emitter.on('userLogout', listener)

      const { result } = renderHook(() => useEvent(emitter, 'userLogout'))

      const emitLogout = result.current
      emitLogout()
      expect(listener).toHaveBeenCalledWith(undefined)
    })

    test('should create new function when emitter or event changes', () => {
      const emitter1 = new TypedEventEmitter<TestEvents>()
      const emitter2 = new TypedEventEmitter<TestEvents>()

      const { result, rerender } = renderHook(
        ({
          emitter,
          event,
        }: {
          emitter: TypedEventEmitter<TestEvents>
          event: keyof TestEvents
        }) => useEvent(emitter, event as any),
        {
          initialProps: {
            emitter: emitter1,
            event: 'userLogin' as keyof TestEvents,
          },
        }
      )

      const emitFunction1 = result.current

      // Change emitter
      rerender({ emitter: emitter2, event: 'userLogin' as keyof TestEvents })
      const emitFunction2 = result.current
      expect(emitFunction2).not.toBe(emitFunction1)

      // Change event
      rerender({ emitter: emitter2, event: 'userLogout' as keyof TestEvents })
      const emitFunction3 = result.current
      expect(emitFunction3).not.toBe(emitFunction2)
    })
  })

  describe('Integration tests', () => {
    test('should work together in a React component scenario', () => {
      function TestComponent() {
        const emitter = useEventEmitter<TestEvents>()
        const [messages, setMessages] = useState<string[]>([])

        useCustomEventListener(emitter, 'userLogin', (user) => {
          setMessages((prev) => [...prev, `Welcome ${user.name}!`])
        })

        useCustomEventListener(emitter, 'userLogout', () => {
          setMessages((prev) => [...prev, 'Goodbye!'])
        })

        const emitLogin = useEvent(emitter, 'userLogin')
        const emitLogout = useEvent(emitter, 'userLogout')

        return {
          messages,
          emitLogin,
          emitLogout,
        }
      }

      const { result } = renderHook(() => TestComponent())

      expect(result.current.messages).toEqual([])

      act(() => {
        result.current.emitLogin({ id: '123', name: 'John' })
      })

      expect(result.current.messages).toEqual(['Welcome John!'])

      act(() => {
        result.current.emitLogout()
      })

      expect(result.current.messages).toEqual(['Welcome John!', 'Goodbye!'])
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
    emitter.once('userLogin', vi.fn())

    expect(emitter.listenerCount('userLogin')).toBe(5)

    // Emit event (should trigger once listener removal)
    emitter.emit('userLogin', { id: '123', name: 'John' })

    expect(emitter.listenerCount('userLogin')).toBe(4)
  })
})
