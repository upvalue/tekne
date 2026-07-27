import { useEffect, useRef } from 'react'
import { keybindings, matchesKeybinding, type KeybindingName } from '@/lib/keys'

/**
 * Installs a window-level binding for a registry entry.
 *
 * The combo that fires and the combo the Help panel renders come from the same
 * string, so the two cannot drift. Bindings owned by kbar or CodeMirror stay
 * with those systems and read the registry through their own adapters.
 */
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
      e.preventDefault()
      handlerRef.current(e)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [name])
}
