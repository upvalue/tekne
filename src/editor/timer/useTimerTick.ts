import { useEffect, useReducer } from 'react'

/**
 * Re-render once a second while `active`, for components that display a
 * running duration derived from Date.now(). Keeping the tick local to the
 * displaying component means a running timer doesn't re-render anything else.
 */
export const useTimerTick = (active: boolean): void => {
  const [, tick] = useReducer((c: number) => c + 1, 0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])
}
