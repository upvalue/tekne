import React from 'react'

export const useEventListener = <K extends keyof WindowEventMap>(
  event: K,
  handler: (event: WindowEventMap[K]) => void
) => {
  React.useEffect(() => {
    window.addEventListener(event, handler)
    return () => window.removeEventListener(event, handler)
  }, [event, handler])
}
