// Command palette provider - manages Cmd-K shortcut and renders global fallback

import React, { useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { focusedLineAtom, commandPaletteOpenAtom } from '@/editor/state'
import { CommandPalette } from './CommandPalette'

export const CommandPaletteProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [paletteOpen, setPaletteOpen] = useAtom(commandPaletteOpenAtom)
  const focusedLineIdx = useAtomValue(focusedLineAtom)

  // Listen for Cmd-K to toggle palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setPaletteOpen])

  // Global fallback palette (when no line is focused)
  // If a line is focused, ELine will render the palette instead
  const shouldRenderGlobalPalette = paletteOpen && focusedLineIdx === null

  return (
    <>
      {children}
      {shouldRenderGlobalPalette && (
        <CommandPalette
          isOpen={true}
          onClose={() => setPaletteOpen(false)}
          lineIdx={null}
          view={null}
        />
      )}
    </>
  )
}
