// Command palette provider - manages Cmd-K shortcut and renders global fallback

import React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import {
  focusedLineAtom,
  commandPaletteOpenAtom,
  commandPaletteSearchAtom,
} from '@/editor/state'
import { CommandPalette } from '@/editor/CommandPalette'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'
import { useDocumentTitles } from '@/hooks/useDocumentTitles'

export const CommandPaletteProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [paletteOpen, setPaletteOpen] = useAtom(commandPaletteOpenAtom)
  const [, setSearch] = useAtom(commandPaletteSearchAtom)
  const focusedLineIdx = useAtomValue(focusedLineAtom)
  // Keeps titles cached so the palette opens with its list already filled.
  useDocumentTitles()

  useGlobalKeybinding('documentSearch', () => {
    setSearch(true)
    setPaletteOpen(true)
  })
  useGlobalKeybinding('commandPalette', () => {
    setSearch(false)
    setPaletteOpen((open) => !open)
  })

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
