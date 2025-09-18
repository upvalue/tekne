import { useState, useRef, useEffect } from 'react'
import { useAtom } from 'jotai'
import { trpc } from '@/trpc/client'
import { useNavigate } from '@tanstack/react-router'
import { errorMessageAtom } from './state'
import { DocumentDetailsButton } from './DocumentDetails'

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
  const editableRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const renameDocMutation = trpc.doc.renameDoc.useMutation({
    onSuccess: () => {
      setErrorMessage(null)
      navigate({
        to: '/n/$title',
        params: {
          title: proposedTitle.trim(),
        },
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
      setProposedTitle(title)
      if (editableRef.current) {
        editableRef.current.textContent = title
      }
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
      renameDocMutation.mutate({
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
    </div>
  )
}
