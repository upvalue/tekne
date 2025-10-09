import React from 'react'
import { KBarProvider, type Action } from 'kbar'
import { useMemo } from 'react'
import { KBarModal, KBarSearchInput, KBarResultRenderer } from './KBar'
import { useRouter, type NavigateFn } from '@tanstack/react-router'
import { docRoute, formatDate } from '@/lib/utils'
import { addDays, parse } from 'date-fns'
import { getDocTitle } from '@/hooks/useDocTitle'
import { trpc } from '@/trpc/client'
import { toast } from 'sonner'

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

  return docRoute(formatDate(newDate));
}

/**
 * Handles navigating from a daily note (e.g. to the next, or previous note)
 */
const dailyNoteNavigate = (navigate: NavigateFn, delta: number) => {
  const title = getDocTitle()
  if (title) {
    // Try to parse as YYYY-MM-DD
    const day = parse(title, 'yyyy-MM-dd', new Date())
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
  const deleteDocMutation = trpc.doc.deleteDoc.useMutation()

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

      {
        id: 'delete-document',
        name: 'Delete current document',
        subtitle: 'Delete the currently open document and navigate to today\'s note',
        perform: async () => {
          const currentTitle = getDocTitle()
          if (!currentTitle) {
            console.error('No document currently open to delete')
            return
          }

          try {
            await deleteDocMutation.mutateAsync({ name: currentTitle })
            openTodaysNote(navigate)
          } catch (error) {
            console.error('Failed to delete document:', error)
          }
        },
        keywords: 'delete document remove',
      },

      {
        id: 'restart-tutorial',
        name: 'Restart tutorial',
        subtitle: 'Restart the tutorial from the beginning',
        perform: async () => {
          try {
            try {
              await deleteDocMutation.mutateAsync({ name: 'Tutorial' })
            } catch (e: any) {
              // Ignore a not found error; it's OK if the tutorial doesn't
              // exist
              if (!e.toString().includes('not found')) {
                throw e;

              }

            }
            if (window.location.pathname === '/n/Tutorial') {
              window.location.reload()
            } else {
              navigate({ to: docRoute('Tutorial') })
            }
          } catch (error) {
            toast.error(`Failed to restart tutorial: ${error}`)
          }
        },
        keywords: 'restart tutorial reset help',
      },
    ]
  }, [deleteDocMutation, navigate])

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
