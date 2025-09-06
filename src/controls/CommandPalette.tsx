import React from 'react'
import { KBarProvider, type Action } from 'kbar'
import { useMemo } from 'react'
import { KBarModal, KBarSearchInput, KBarResultRenderer } from './KBar'
import { useLocation, useRouter, type NavigateFn } from '@tanstack/react-router'
import { formatDate } from '@/lib/utils'
import { addDays, parse } from 'date-fns'

const CommandPaletteContent = () => {
  return (
    <KBarModal>
      <KBarSearchInput placeholder="Run a command…" />
      <div className="border-t border-gray-200 overflow-y-auto">
        <KBarResultRenderer />
      </div>
    </KBarModal>
  )
}

/**
 * Returns the actual nav path for a given date
 */
const getDayNotePath = (date: Date, delta: number) => {
  const newDate = addDays(date, delta)

  return `/n/${formatDate(newDate)}`
}

/**
 * Handles navigating from a daily note (e.g. to the next, or previous note)
 */
const dailyNoteNavigate = (navigate: NavigateFn, delta: number) => {
  const path = window.location.pathname
  if (path.startsWith('/n/')) {
    // Try to parse as YYYY-MM-DD
    const day = parse(path.slice(3), 'yyyy-MM-dd', new Date())
    if (isNaN(day.getTime())) {
      return
    }

    navigate({ to: getDayNotePath(day, delta) })
  }
}

const openTodaysNote = (navigate: NavigateFn) => {
  navigate({ to: getDayNotePath(new Date(), 0) })
}

export const CommandPalette: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { navigate } = useRouter()

  // Get the current path
  const location = useLocation()
  const path = location.pathname

  // Lorem ipsum actions for testing
  const actions = useMemo((): Action[] => {
    return [
      {
        id: 'daily-note-today',
        name: "Open today's daily note",
        subtitle: "Open today's daily note",
        perform: () => openTodaysNote(navigate),
        keywords: 'daily note today',
      },
      {
        id: 'daily-note-yesterday',
        name: 'Open previous daily note',
        subtitle: `Opens the previous day's daily note -- only works when a daily note is open`,
        perform: () => dailyNoteNavigate(navigate, -1),
        keywords: 'daily note yesterday',
      },

      {
        id: 'daily-note-tomorrow',
        name: 'Open next daily note',
        subtitle: `Opens the next day's daily note -- only works when a daily note is open`,
        perform: () => dailyNoteNavigate(navigate, 1),
        keywords: 'daily note tomorrow',
      },
    ]
  }, [path])

  return (
    <KBarProvider
      actions={actions}
      options={{
        toggleShortcut: '$mod+Shift+k',
      }}
    >
      <CommandPaletteContent />
      {children}
    </KBarProvider>
  )
}
