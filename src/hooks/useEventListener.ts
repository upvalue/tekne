import React from 'react'
import { useEffect } from 'react'

export const useEventListener = (event: string, handler: (event: Event) => void) => {
  React.useEffect(() => {
    window.addEventListener(event, handler)
    return () => window.removeEventListener(event, handler)
  }, [event, handler])
}