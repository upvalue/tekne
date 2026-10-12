import { useAtomValue, useSetAtom, useAtom, useStore } from 'jotai'
import { useEffect, useRef, useMemo, useState } from 'react'
import { docAtom, focusedLineAtom } from './state'
import {
  errorMessageAtom,
  globalTimerAtom,
  goToLineOpenAtom,
  showLineNumbersAtom,
  requestFocusLineAtom,
  findLineById,
} from './state'
import {
  X,
  TriangleAlert,
  Square,
  List,
  Clock,
  Pause,
  Play,
} from 'lucide-react'
import { TimerInfo } from './TimerInfo'
import { formatTimeDisplay } from '@/lib/time'
import {
  isTimerPaused,
  pauseTimer,
  resumeTimer,
  stopAndSaveTimer,
} from './timer/timer-controller'
import { useGlobalKeybinding } from '@/hooks/useGlobalKeybinding'

const STATUS_BAR_TRUNCATE_LENGTH = 50

const LoadingDots = () => {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return <div className="text-sm text-text-2">Loading{'.'.repeat(dots)}</div>
}

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

export const StatusBar = ({ isLoading }: { isLoading: boolean }) => {
  const doc = useAtomValue(docAtom)
  const errorMessage = useAtomValue(errorMessageAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const globalTimer = useAtomValue(globalTimerAtom)
  const store = useStore()
  const focusedLine = useAtomValue(focusedLineAtom)
  const [goToLineOpen, setGoToLineOpen] = useAtom(goToLineOpenAtom)

  useGlobalKeybinding('goToLine', () => setGoToLineOpen((open) => !open))

  const totalDocTime = useMemo(() => {
    return doc.children.reduce(
      (acc, line) => acc + (line.datumTimeSeconds || 0),
      0
    )
  }, [doc.children])

  const currentLineBaseTime = useMemo(() => {
    if (globalTimer.isActive && globalTimer.lineId !== null) {
      const found = findLineById(doc, globalTimer.lineId)
      return found?.line.datumTimeSeconds || 0
    }
    return 0
  }, [globalTimer.isActive, globalTimer.lineId, doc])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [errorMessage, setErrorMessage])

  return (
    <div className="StatusBar font-mono w-full h-10 bg-raised px-4 md:px-[138px] flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isLoading && <LoadingDots />}
        {errorMessage && (
          <div className="flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-accent" />
            <div className="text-sm text-accent">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="cursor-pointer"
            >
              <X className="w-4 h-4 text-text-2" />
            </button>
          </div>
        )}
        {globalTimer.isActive && (
          <div className="flex items-center gap-2 text-sm">
            {isTimerPaused(globalTimer) ? (
              <Play
                className="w-4 h-4 text-accent cursor-pointer hover:text-accent"
                onClick={() => resumeTimer(store)}
              />
            ) : (
              <Pause
                className="w-4 h-4 text-accent cursor-pointer hover:text-accent"
                onClick={() => pauseTimer(store)}
              />
            )}
            <Square
              className="w-4 h-4 text-accent cursor-pointer hover:text-accent"
              onClick={() => {
                stopAndSaveTimer(store)
              }}
            />
            <div
              className={`flex items-center gap-1 ${
                isTimerPaused(globalTimer) ? 'text-accent' : 'text-accent'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isTimerPaused(globalTimer)
                    ? 'bg-accent'
                    : 'bg-accent animate-pulse'
                }`}
              />
              <TimerInfo
                baseTime={currentLineBaseTime}
                globalTimer={globalTimer}
                isThisTimer={true}
                className="font-mono"
              />
            </div>
            <div className="text-text-2">
              {globalTimer.noteTitle && `${globalTimer.noteTitle}: `}
              {globalTimer.lineContent
                ? globalTimer.lineContent.substring(
                    0,
                    STATUS_BAR_TRUNCATE_LENGTH
                  ) + '...'
                : globalTimer.lineContent}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {!isLoading &&
          doc.children.length > 1 &&
          (goToLineOpen ? (
            <GoToLineInput
              totalLines={doc.children.length}
              onClose={() => setGoToLineOpen(false)}
            />
          ) : (
            <div className="text-sm text-text-2 flex items-center">
              {focusedLine !== null ? (
                `${focusedLine + 1}/`
              ) : (
                <span>&nbsp;&nbsp;</span>
              )}
              {doc.children.length}
              &nbsp;
              <List className="w-4 h-4" />
            </div>
          ))}
        {totalDocTime > 0 && (
          <div className="text-sm text-text-2 flex items-center gap-2">
            {formatTimeDisplay(totalDocTime)}
            <Clock className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
}
