import { apiErrorMessage } from '@/api/errors'
import { useMutation } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { useAtom } from 'jotai'
import { orpc } from '@/api/client'
import { useNavigate } from '@tanstack/react-router'
import { errorMessageAtom } from './state'
import { StatusBar } from './StatusBar'
import { usePanelVisible } from '@/hooks/panel-state'
import { commandPaletteOpenAtom } from './state'
import { ChevronLeft, ChevronRight, PanelRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { RunningTimerPill } from './timer/RunningTimerPill'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/vendor/Dialog'
import { Button } from '@/components/vendor/Button'
import { EditorDialogContent } from '@/components/EditorDialogContent'
import { toast } from 'sonner'

/*
 * Title bar; allows user to change the title of a document
 */
export const TitleBar = ({
  title,
  allowTitleEdit = false,
  isLoading = false,
}: {
  title: string
  allowTitleEdit?: boolean
  isLoading?: boolean
}) => {
  const [proposedTitle, setProposedTitle] = useState(title)
  const [, setErrorMessage] = useAtom(errorMessageAtom)
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    show: boolean
    linksToUpdate: Array<{ title: string }>
  }>({ show: false, linksToUpdate: [] })
  const editableRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [panelVisible, setPanelVisible] = usePanelVisible()
  const [, setPaletteOpen] = useAtom(commandPaletteOpenAtom)
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(title)
  const goDay = (offset: number) => {
    const date = new Date(`${title}T12:00:00`)
    date.setDate(date.getDate() + offset)
    void navigate({ to: '/n/$title', params: { title: formatDate(date) } })
  }

  const setDisplayedTitle = (title: string) => {
    setProposedTitle(title)
    if (editableRef.current) {
      editableRef.current.textContent = title
    }
  }

  const renameDocExecuteMutation = useMutation(
    orpc.doc.renameDocExecute.mutationOptions({
      onSuccess: () => {
        toast.success(`Document renamed to "${proposedTitle.trim()}"`)
        navigate({
          to: '/n/$title',
          params: { title: proposedTitle.trim() },
        })
      },
      onError: (error) => {
        setErrorMessage(error.message)
        setDisplayedTitle(title)
      },
    })
  )

  const renameDocProposeMutation = useMutation(
    orpc.doc.renameDocPropose.mutationOptions({
      onSuccess: (res) => {
        setErrorMessage(null)

        if (res.docAlreadyExists) {
          setErrorMessage(
            `Document with name "${proposedTitle.trim()}" already exists`
          )
          setDisplayedTitle(title)
          return
        }

        // Show confirmation dialog when renaming is possible
        setShowConfirmDialog({
          show: true,
          linksToUpdate: res.linksToUpdate,
        })
      },
      onError: (error) => {
        setErrorMessage(apiErrorMessage(error))

        // Revert the title to the original
        setDisplayedTitle(title)
      },
    })
  )

  useEffect(() => {
    setProposedTitle(title)
    if (editableRef.current) {
      editableRef.current.textContent = title
    }
  }, [title])

  const handleSubmit = () => {
    if (proposedTitle.trim() !== title && allowTitleEdit) {
      renameDocProposeMutation.mutate({
        oldName: title,
        newName: proposedTitle.trim(),
      })
    } else {
      setErrorMessage(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setProposedTitle(title)
      if (editableRef.current) {
        editableRef.current.textContent = title
      }
      setErrorMessage(null)
    }
  }

  return (
    <header className="TitleBar">
      <div className="flex items-center gap-3 min-w-0">
        <div
          ref={editableRef}
          contentEditable={allowTitleEdit && !isDate}
          suppressContentEditableWarning
          aria-label="Document title"
          className="text-[28px] font-semibold tracking-tight outline-none min-w-0 truncate"
          onInput={(e) => setProposedTitle(e.currentTarget.textContent || '')}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
        />
        {isDate && (
          <nav
            aria-label="Date navigation"
            className="flex items-center gap-1 text-muted text-xs"
          >
            <button aria-label="Previous day" onClick={() => goDay(-1)}>
              <ChevronLeft size={18} />
            </button>
            <button aria-label="Next day" onClick={() => goDay(1)}>
              <ChevronRight size={18} />
            </button>
            <button
              className="px-1 hover:text-text"
              onClick={() =>
                navigate({
                  to: '/n/$title',
                  params: { title: formatDate(new Date()) },
                })
              }
            >
              Today
            </button>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3 text-muted shrink-0">
          <RunningTimerPill />
          <button
            aria-label="Open command palette"
            onClick={() => setPaletteOpen(true)}
            className="text-xs hover:text-text"
          >
            ⌘K
          </button>
          <button
            aria-label={panelVisible ? 'Hide panel' : 'Show panel'}
            onClick={() => setPanelVisible(!panelVisible)}
            className="hover:text-text"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>
      <StatusBar title={title} isLoading={isLoading} />

      <Dialog
        open={showConfirmDialog.show}
        onOpenChange={(open) =>
          setShowConfirmDialog((sc) => ({ ...sc, show: open }))
        }
      >
        <EditorDialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rename</DialogTitle>
            <DialogDescription>
              Confirm the rename of the document
            </DialogDescription>
          </DialogHeader>
          <div>
            Are you sure you want to rename "{title}" to "{proposedTitle.trim()}
            "?
          </div>

          {showConfirmDialog.linksToUpdate.length > 0 && (
            <>
              <div>
                This will update {showConfirmDialog.linksToUpdate.length} other
                document{showConfirmDialog.linksToUpdate.length > 1 ? 's' : ''}.
              </div>
              <div>
                {showConfirmDialog.linksToUpdate.map((link) => (
                  <div key={link.title}>{link.title}</div>
                ))}
              </div>
            </>
          )}
          <DialogFooter>
            <Button
              outline
              onClick={() => {
                setShowConfirmDialog((sc) => ({ ...sc, show: false }))
                setDisplayedTitle(title)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog((sc) => ({ ...sc, show: false }))
                renameDocExecuteMutation.mutate({
                  oldName: title,
                  newName: proposedTitle.trim(),
                })
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </EditorDialogContent>
      </Dialog>
    </header>
  )
}
