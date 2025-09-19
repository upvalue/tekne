import { useState, useRef, useEffect } from 'react'
import { useAtom } from 'jotai'
import { trpc } from '@/trpc/client'
import { useNavigate } from '@tanstack/react-router'
import { errorMessageAtom } from './state'
import { DocumentDetailsButton } from './DocumentDetails'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/vendor/Dialog'
import { Button } from '@/components/vendor/Button'
import { EditorDialogContent } from '@/components/EditorDialogContent'

/*
 * Title bar; allows user to change the title of a document
 */
export const TitleBar = ({
  title,
  allowTitleEdit = false,
}: {
  title: string
  allowTitleEdit?: boolean
}) => {
  const [proposedTitle, setProposedTitle] = useState(title)
  const [, setErrorMessage] = useAtom(errorMessageAtom)
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    show: boolean
    linksToUpdate: Array<{ title: string }>
  }>({ show: false, linksToUpdate: [] })
  const editableRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const setDisplayedTitle = (title: string) => {
    setProposedTitle(title)
    if (editableRef.current) {
      editableRef.current.textContent = title
    }
  }

  const renameDocExecuteMutation = trpc.doc.renameDocExecute.useMutation({
    onSuccess: (r) => {
      if (r.success) {
        navigate({
          to: '/n/$title',
          params: { title: proposedTitle.trim() },
        })
      }
    },
  })

  const renameDocProposeMutation = trpc.doc.renameDocPropose.useMutation({
    onSuccess: (res) => {
      setErrorMessage(null)

      if (res.docAlreadyExists) {
        setErrorMessage(`Document with name "${proposedTitle.trim()}" already exists`)
        setDisplayedTitle(title)
        return;
      }

      // Show confirmation dialog when renaming is possible
      setShowConfirmDialog({
        show: true,
        linksToUpdate: res.linksToUpdate,
      })
    },
    onError: (error) => {
      // Extract a clean error message from TRPC/Zod validation errors
      let message = error.message
      try {
        const parsed = JSON.parse(message)
        if (Array.isArray(parsed) && parsed[0]?.message) {
          message = parsed[0].message
        }
      } catch {
        // If parsing fails, use the original message
      }
      setErrorMessage(message)

      // Revert the title to the original
      setDisplayedTitle(title)
    },
  })

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
      });

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

  const isDev = import.meta.env.DEV
  const isDemo = import.meta.env.TEKNE_DEMO
  const isDevServer =
    import.meta.env.TEKNE_TRPC_URL &&
    import.meta.env.TEKNE_TRPC_URL.includes('localhost')

  return (
    <div className="flex py-2 px-4 items-center TitleBar">
      <div style={{ flexBasis: '138px' }} className="flex justify-end pr-4">
        <div className="text text-sky-500">{isDev && '[dev]'}</div>
        <div className="text text-sky-500">{isDemo && '[demo]'}</div>
        <div className="text text-sky-500">{isDevServer && '[server]'}</div>
      </div>

      <div className="w-full">
        <div className="flex justify-between w-full">
          <div className="flex flex-col w-full">
            <div
              ref={editableRef}
              contentEditable={allowTitleEdit}
              suppressContentEditableWarning={true}
              className="text-2xl text-zinc-500 outline-none w-full"
              onInput={(e) =>
                setProposedTitle(e.currentTarget.textContent || '')
              }
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex items-center">
            <DocumentDetailsButton />
          </div>
        </div>
      </div>

      <Dialog open={showConfirmDialog.show} onOpenChange={(open) => setShowConfirmDialog(sc => ({ ...sc, show: open }))}>
        <EditorDialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rename</DialogTitle>
            <DialogDescription>Confirm the rename of the document</DialogDescription>
          </DialogHeader>
          <div>

            Are you sure you want to rename "{title}" to "{proposedTitle.trim()}"?
          </div>

          {showConfirmDialog.linksToUpdate.length > 0 && (
            <>
              <div>This will update {showConfirmDialog.linksToUpdate.length} other document{showConfirmDialog.linksToUpdate.length > 1 ? 's' : ''}.</div>
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
                setShowConfirmDialog(sc => ({ ...sc, show: false }))
                setDisplayedTitle(title)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(sc => ({ ...sc, show: false }))
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
    </div>
  )
}
