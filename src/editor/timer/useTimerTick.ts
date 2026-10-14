import { useEffect, useReducer } from 'react'

/** Tick locally so running timers only re-render their display components. */
export const useTimerTick = (active: boolean): void => {
  const [, tick] = useReducer((c: number) => c + 1, 0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])
}
