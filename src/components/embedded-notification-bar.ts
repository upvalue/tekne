import { useLayoutEffect, useSyncExternalStore } from 'react'

// Editor pages render the bar under the document; the root renders a
// full-width one only while no editor has claimed it.
let embeddedBars = 0
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const setEmbeddedBars = (count: number) => {
  embeddedBars = count
  for (const listener of listeners) listener()
}

export const useEmbeddedNotificationBar = () =>
  useSyncExternalStore(subscribe, () => embeddedBars > 0)

export const useClaimNotificationBar = (claim: boolean) =>
  useLayoutEffect(() => {
    if (!claim) return
    setEmbeddedBars(embeddedBars + 1)
    return () => setEmbeddedBars(embeddedBars - 1)
  }, [claim])
