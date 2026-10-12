import { apiErrorMessage } from '@/api/errors'
import { useMutation } from '@tanstack/react-query'
import { useState, useRef, useLayoutEffect } from 'react'
import { orpc } from '@/api/client'
import { useNavigate } from '@tanstack/react-router'
import { StatusBar } from './StatusBar'
import { DateNavigation } from './DateNavigation'
import { Button } from '@/components/vendor/Button'
import { toast } from 'sonner'

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
  const [reviewing, setReviewing] = useState(false)
  const [preview, setPreview] = useState<{
    newName: string
    linksToUpdate: Array<{ title: string }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const navigate = useNavigate()
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(title)
  const editable = allowTitleEdit && !isDate
  const propose = useMutation(orpc.doc.renameDocPropose.mutationOptions())
  const execute = useMutation(orpc.doc.renameDocExecute.mutationOptions())

  const reset = () => {
    generation.current++
    setProposedTitle(title)
    setReviewing(false)
    setPreview(null)
    setError(null)
  }

  useLayoutEffect(() => {
    generation.current++
    setProposedTitle(title)
    setReviewing(false)
    setPreview(null)
    setError(null)
  }, [title])

  const review = async () => {
    const newName = proposedTitle.trim()
    if (!editable || execute.isPending || newName === title) return
    if (reviewing && preview?.newName === newName) return
    const request = ++generation.current
    setReviewing(true)
    setPreview(null)
    setError(null)
    if (!newName) {
      setError('Enter a title.')
      return
    }
    try {
      const result = await propose.mutateAsync({ oldName: title, newName })
      if (request !== generation.current) return
      if (result.docAlreadyExists) {
        setError(`Document with name "${newName}" already exists`)
      } else {
        setPreview({ newName, linksToUpdate: result.linksToUpdate })
      }
    } catch (error) {
      if (request === generation.current)
        setError(
          apiErrorMessage(
            error instanceof Error ? error : new Error(String(error))
          )
        )
    }
  }

  const save = async () => {
    if (!preview || execute.isPending) return
    const newName = preview.newName
    const request = generation.current
    try {
      await execute.mutateAsync({ oldName: title, newName })
      if (request !== generation.current) return
      toast.success(`Document renamed to "${newName}"`)
      await navigate({ to: '/n/$title', params: { title: newName } })
    } catch (error) {
      if (request === generation.current)
        setError(
          apiErrorMessage(
            error instanceof Error ? error : new Error(String(error))
          )
        )
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
        <input
          aria-label="Document title"
          aria-invalid={!!error}
          readOnly={!editable || execute.isPending}
          value={proposedTitle}
          className="flex-1 w-full text-2xl font-normal text-text-2 bg-transparent outline-none min-w-0"
          onChange={(event) => {
            generation.current++
            setProposedTitle(event.target.value)
            setReviewing(false)
            setPreview(null)
            setError(null)
          }}
          onBlur={() => void review()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            } else if (event.key === 'Escape' && !execute.isPending) {
              event.preventDefault()
              reset()
            }
          }}
        />
        {reviewing && (
          <div className="flex shrink-0 gap-1">
            <Button
              plain
              disabled={!preview || execute.isPending}
              onClick={() => void save()}
            >
              {execute.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button plain disabled={execute.isPending} onClick={reset}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-text-2">
          {error}
        </p>
      )}
      {reviewing && preview && preview.linksToUpdate.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          Also updates links in{' '}
          {preview.linksToUpdate.map((link) => link.title).join(', ')}.
        </p>
      )}
      <StatusBar title={title} isLoading={isLoading} />
    </header>
  )
}
