import { useAtomValue, useSetAtom, useAtom } from 'jotai'
import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { docAtom, focusedLineAtom } from './state'
import { errorMessageAtom, globalTimerAtom, goToLineOpenAtom, showLineNumbersAtom, requestFocusLineAtom } from './state'
import { Button } from '@headlessui/react'
import { X } from 'lucide-react'
import { ExclamationTriangleIcon, StopIcon, ListBulletIcon, ClockIcon } from '@heroicons/react/16/solid'
import { trpc } from '@/trpc/client'
import { setDetailTitle } from '@/lib/title'
import { noop } from 'lodash-es'
import { TimerInfo } from './TimerInfo'

const STATUS_BAR_TRUNCATE_LENGTH = 50

const LoadingDots = () => {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-sm text-zinc-400">
      Loading{'.'.repeat(dots)}
    </div>
  )
}

const formatTimeDisplay = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const GoToLineInput = ({ totalLines, onClose }: { totalLines: number; onClose: () => void }) => {
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
    <div className="text-sm text-zinc-400 flex items-center gap-1">
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
        className="w-12 bg-zinc-600 text-zinc-200 text-sm px-1 outline-none font-mono"
        placeholder={`1-${totalLines}`}
      />
      <span>/ {totalLines}</span>
      <ListBulletIcon className="w-4 h-4" />
    </div>
  )
}

export const StatusBar = ({ isLoading }: { isLoading: boolean }) => {
  const doc = useAtomValue(docAtom)
  const errorMessage = useAtomValue(errorMessageAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const globalTimer = useAtomValue(globalTimerAtom)
  const { stopTimer } = globalTimer
  const execHook = trpc.execHook.useMutation()
  const focusedLine = useAtomValue(focusedLineAtom);
  const [goToLineOpen, setGoToLineOpen] = useAtom(goToLineOpenAtom)

  // Listen for Ctrl+G to toggle go-to-line input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault()
        setGoToLineOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setGoToLineOpen])

  const totalDocTime = useMemo(() => {
    return doc.children.reduce((acc, line) => acc + (line.datumTimeSeconds || 0), 0)
  }, [doc.children])

  const currentLineBaseTime = useMemo(() => {
    if (globalTimer.isActive && globalTimer.lineIdx !== null) {
      return doc.children[globalTimer.lineIdx]?.datumTimeSeconds || 0
    }
    return 0
  }, [globalTimer.isActive, globalTimer.lineIdx, doc.children])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [errorMessage, setErrorMessage])

  return (
    <div className="StatusBar font-mono w-full h-10 bg-zinc-800 px-[138px] flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isLoading && <LoadingDots />}
        {errorMessage && (
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
            <div className="text-sm text-red-400">{errorMessage}</div>
            <Button
              onClick={() => setErrorMessage(null)}
              className="cursor-pointer"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </Button>
          </div>
        )}
        {globalTimer.isActive && (
          <div className="flex items-center gap-2 text-sm">
            <StopIcon
              className="w-4 h-4 text-red-400 cursor-pointer hover:text-red-300"
              onClick={() => {
                console.log('Stopping ye timer');
                console.log({ stopTimer });
                stopTimer()
              }}
            />
            <div className="flex items-center gap-1 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <TimerInfo
                baseTime={currentLineBaseTime}
                globalTimer={globalTimer}
                isThisTimer={true}
                className="font-mono"
              />
            </div>
            <div className="text-zinc-400">
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

        {!isLoading && doc.children.length > 1 && (
          goToLineOpen ? (
            <GoToLineInput
              totalLines={doc.children.length}
              onClose={() => setGoToLineOpen(false)}
            />
          ) : (
            <div className="text-sm text-zinc-400 flex items-center">
              {focusedLine !== null ? `${focusedLine + 1}/` : <span>&nbsp;&nbsp;</span>}{doc.children.length}
              &nbsp;
              <ListBulletIcon className="w-4 h-4" />
            </div>
          )
        )}
        {totalDocTime > 0 && (
          <div className="text-sm text-zinc-400 flex items-center gap-2">
            {formatTimeDisplay(totalDocTime)}
            <ClockIcon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div >
  )
}
