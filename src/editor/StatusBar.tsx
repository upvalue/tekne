import { LoadingIndicator } from '@/components/LoadingIndicator'
import { useAtomValue, useSetAtom, useAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import {
  docAtom,
  errorMessageAtom,
  goToLineOpenAtom,
  showLineNumbersAtom,
  requestFocusLineAtom,
} from './state'
import { List } from 'lucide-react'
import { renderTime } from '@/lib/time'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'
import { toast } from 'sonner'
import { RunningTimerPill } from './timer/RunningTimerPill'

const GoToLineInput = ({
  totalLines,
  onClose,
}: {
  totalLines: number
  onClose: () => void
}) => {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const setRequestFocusLine = useSetAtom(requestFocusLineAtom)
  const setShowLineNumbers = useSetAtom(showLineNumbersAtom)

  useEffect(() => {
    inputRef.current?.focus()
    setShowLineNumbers(true)
    return () => setShowLineNumbers(false)
  }, [setShowLineNumbers])

  const handleSubmit = () => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= totalLines) {
      setRequestFocusLine({ lineIdx: num - 1, pos: 0 })
    }
    onClose()
  }

  return (
    <div className="text-sm text-text-2 flex items-center gap-1">
      <span>Go to:</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const filtered = e.target.value.replace(/[^0-9]/g, '')
          setValue(filtered)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        onBlur={onClose}
        className="w-12 bg-muted text-text text-sm px-1 outline-none font-mono"
        placeholder={`1-${totalLines}`}
      />
      <span>/ {totalLines}</span>
      <List className="w-4 h-4" />
    </div>
  )
}

export const StatusBar = ({
  isLoading,
  title,
}: {
  isLoading: boolean
  title: string
}) => {
  const doc = useAtomValue(docAtom)
  const errorMessage = useAtomValue(errorMessageAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const [goToLineOpen, setGoToLineOpen] = useAtom(goToLineOpenAtom)
  useGlobalKeybinding('goToLine', () => setGoToLineOpen((open) => !open))
  useEffect(() => {
    if (!errorMessage) return
    toast.error(errorMessage)
    setErrorMessage(null)
  }, [errorMessage, setErrorMessage])
  const lines = doc.children.filter(
    (line) =>
      line.mdContent.trim() || line.datumTaskStatus || line.datumTimeSeconds
  )
  const totalTime = lines.reduce(
    (sum, line) => sum + (line.datumTimeSeconds ?? 0),
    0
  )
  const openTasks = lines.filter(
    (line) => line.datumTaskStatus === 'unset'
  ).length
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(title)
    ? new Date(`${title}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
      })
    : null
  return (
    <div className="DocumentSummary flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted mt-1">
      {weekday && (
        <>
          <span>{weekday}</span>
          <span>·</span>
        </>
      )}
      {isLoading ? (
        <LoadingIndicator label="Loading document" />
      ) : (
        <>
          <span>{lines.length} lines</span>
          <span>·</span>
          <span>{openTasks} open</span>
          {totalTime > 0 && (
            <>
              <span>·</span>
              <span>{renderTime(totalTime)} logged</span>
            </>
          )}
        </>
      )}
      <RunningTimerPill />
      {goToLineOpen && (
        <GoToLineInput
          totalLines={doc.children.length}
          onClose={() => setGoToLineOpen(false)}
        />
      )}
    </div>
  )
}
