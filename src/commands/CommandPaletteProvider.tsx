// Command palette provider - manages Cmd-K shortcut and renders global fallback

import React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { focusedLineAtom, commandPaletteOpenAtom } from '@/editor/state'
import { CommandPalette } from './CommandPalette'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'

export const CommandPaletteProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [paletteOpen, setPaletteOpen] = useAtom(commandPaletteOpenAtom)
  const focusedLineIdx = useAtomValue(focusedLineAtom)

  useGlobalKeybinding('commandPalette', () => setPaletteOpen((open) => !open))

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
