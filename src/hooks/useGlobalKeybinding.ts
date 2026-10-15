import { useEffect, useRef } from 'react'
import { keybindings, matchesKeybinding, type KeybindingName } from '@/lib/keys'

/** Installs a window binding using the same registry combo shown in Help. */
export const useGlobalKeybinding = (
  name: KeybindingName,
  handler: (e: KeyboardEvent) => void
) => {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    const binding = keybindings[name]

    const onKeyDown = (e: KeyboardEvent) => {
      if (!matchesKeybinding(binding, e)) return
      // A reserved browser shortcut must not also open our document picker.
      if (name === 'documentSearch' && !e.cancelable) return
      e.preventDefault()
      handlerRef.current(e)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [name])
}
