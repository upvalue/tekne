import { useEffect, useRef, useMemo } from 'react'


// Example usage:
/*
import { useEventEmitter, useEventListener, useEvent } from './@/lib/events'

type Events = {
  userLogin: { id: string; name: string }
  userLogout: undefined
  dataUpdate: { timestamp: number; payload: any }
}

function MyComponent() {
  const emitter = useEventEmitter<Events>()
  
  // Listen to events
  useEventListener(emitter, 'userLogin', (user) => {
    console.log(`Welcome ${user.name}!`) // user is fully typed
  })
  
  useEventListener(emitter, 'userLogout', () => {
    console.log('Goodbye!') // No parameters for undefined events
  })
  
  // Get typed emit functions
  const emitLogin = useEvent(emitter, 'userLogin')
  const emitLogout = useEvent(emitter, 'userLogout')
  
  return (
    <div>
      <button onClick={() => emitLogin({ id: '123', name: 'John' })}>
        Login
      </button>
      <button onClick={() => emitLogout()}>
        Logout
      </button>
    </div>
  )
}

// Direct usage outside of components
const globalEmitter = new TypedEventEmitter<Events>()

globalEmitter.on('userLogin', (user) => {
  console.log(user.name) // Fully typed!
})

globalEmitter.emit('userLogin', { id: '456', name: 'Jane' })
globalEmitter.emit('userLogout') // No arguments needed

// TypeScript will error on these:
// globalEmitter.emit('userLogin') // Error: Expected 1 argument
// globalEmitter.emit('userLogout', {}) // Error: Expected 0 arguments
// globalEmitter.emit('unknownEvent', {}) // Error: 'unknownEvent' not in Events
*/

export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<(data: any) => void>>()

  on<K extends keyof TEvents>(
    event: K,
    listener: TEvents[K] extends undefined
      ? () => void
      : (data: TEvents[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    const listenersSet = this.listeners.get(event)!
    listenersSet.add(listener as any)

    // Return unsubscribe function
    return () => {
      listenersSet.delete(listener as any)
      if (listenersSet.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  off<K extends keyof TEvents>(
    event: K,
    listener: TEvents[K] extends undefined
      ? () => void
      : (data: TEvents[K]) => void
  ): void {
    const listenersSet = this.listeners.get(event)
    if (listenersSet) {
      listenersSet.delete(listener as any)
      if (listenersSet.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  emit<K extends keyof TEvents>(
    event: K,
    ...args: TEvents[K] extends undefined ? [] : [data: TEvents[K]]
  ): void {
    const listenersSet = this.listeners.get(event)
    if (listenersSet) {
      listenersSet.forEach((listener) => {
        listener(args[0])
      })
    }
  }

  once<K extends keyof TEvents>(
    event: K,
    listener: TEvents[K] extends undefined
      ? () => void
      : (data: TEvents[K]) => void
  ): () => void {
    const wrapper = (data: any) => {
      this.off(event, wrapper as any)
      ;(listener as any)(data)
    }

    return this.on(event, wrapper as any)
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  listenerCount(event: keyof TEvents): number {
    const listenersSet = this.listeners.get(event)
    return listenersSet ? listenersSet.size : 0
  }
}

// Hook: useEventEmitter
export function useEventEmitter<
  TEvents extends Record<string, any>,
>(): TypedEventEmitter<TEvents> {
  const emitterRef = useRef<TypedEventEmitter<TEvents> | null>(null)

  if (!emitterRef.current) {
    emitterRef.current = new TypedEventEmitter<TEvents>()
  }

  return emitterRef.current
}

// Hook: useCustomEventListener
export function useCustomEventListener<
  TEvents extends Record<string, any>,
  K extends keyof TEvents,
>(
  emitter: TypedEventEmitter<TEvents>,
  event: K,
  handler: TEvents[K] extends undefined
    ? () => void
    : (data: TEvents[K]) => void
): void {
  const handlerRef = useRef(handler)

  // Update ref on each render to avoid stale closures
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    // Create stable wrapper that calls current handler
    const wrapper = (data: any) => {
      handlerRef.current(data)
    }

    const unsubscribe = emitter.on(event, wrapper as any)

    return unsubscribe
  }, [emitter, event])
}

// Hook: useEvent (emit helper)
export function useEvent<
  TEvents extends Record<string, any>,
  K extends keyof TEvents,
>(
  emitter: TypedEventEmitter<TEvents>,
  event: K
): TEvents[K] extends undefined ? () => void : (data: TEvents[K]) => void {
  return useMemo(() => {
    return ((data?: any) => {
      if (data !== undefined) {
        ;(emitter.emit as any)(event, data)
      } else {
        ;(emitter.emit as any)(event)
      }
    }) as any
  }, [emitter, event])
}
