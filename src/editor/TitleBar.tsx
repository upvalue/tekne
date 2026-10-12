import { apiErrorMessage } from '@/api/errors'
import { useMutation } from '@tanstack/react-query'
import { useState, useRef, useLayoutEffect } from 'react'
import { useAtom } from 'jotai'
import { orpc } from '@/api/client'
import { useNavigate } from '@tanstack/react-router'
import { errorMessageAtom } from './state'
import { StatusBar } from './StatusBar'
import { DateNavigation } from './DateNavigation'
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
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(title)

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

  useLayoutEffect(() => {
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
      {isDate && (
        <DateNavigation
          value={title}
          onChange={(date) =>
            void navigate({ to: '/n/$title', params: { title: date } })
          }
        />
      )}
      <div className="flex items-center gap-3 min-w-0">
        <div
          ref={editableRef}
          contentEditable={allowTitleEdit && !isDate}
          suppressContentEditableWarning
          aria-label="Document title"
          className="text-lg font-normal text-text-2 outline-none min-w-0 truncate"
          onInput={(e) => setProposedTitle(e.currentTarget.textContent || '')}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
        />
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
