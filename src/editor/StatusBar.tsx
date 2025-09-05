import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useCallback, useRef } from 'react'
import { docAtom } from './state'
import { errorMessageAtom, globalTimerAtom } from './state'
import { Button } from '@headlessui/react'
import { X } from 'lucide-react'
import { ExclamationTriangleIcon, StopIcon } from '@heroicons/react/16/solid'
import { trpc } from '@/trpc/client'
import { setDetailTitle } from '@/lib/title'

const STATUS_BAR_TRUNCATE_LENGTH = 80;

const formatTimeDisplay = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export const StatusBar = () => {
  const doc = useAtomValue(docAtom)
  const errorMessage = useAtomValue(errorMessageAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const globalTimer = useAtomValue(globalTimerAtom)
  const setGlobalTimerAtom = useSetAtom(globalTimerAtom)
  const execHook = trpc.execHook.useMutation()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    execHook.mutate({
      hook: 'timer-stop',
      argument: {
        doc,
        line: globalTimer.lineContent || '',
      }
    })

    setDetailTitle(null)

    setGlobalTimerAtom({
      isActive: false,
      lineIdx: null,
      lineContent: null,
      mode: 'stopwatch',
      startTime: null,
      targetDuration: 25 * 60,
      elapsedTime: 0,
    })
  }, [globalTimer.lineContent, setGlobalTimerAtom, execHook])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [errorMessage, setErrorMessage])

  useEffect(() => {
    if (globalTimer.isActive && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setGlobalTimerAtom(prev => {
          if (!prev.isActive) return prev

          const now = Date.now()
          const elapsed = Math.floor((now - (prev.startTime || now)) / 1000)

          if (prev.mode === 'stopwatch') {
            return { ...prev, elapsedTime: elapsed }
          } else if (prev.mode === 'countdown') {
            const remaining = Math.max(0, prev.targetDuration - elapsed)
            return { ...prev, elapsedTime: remaining }
          }
          return prev
        })
      }, 1000)
    } else if (!globalTimer.isActive && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [globalTimer.isActive, setGlobalTimerAtom])

  return (
    <div className="StatusBar w-full h-10 bg-zinc-900 px-[138px] flex items-center justify-between">
      <div className="flex items-center gap-4">
        {errorMessage && (
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
            <div className="text-sm text-red-400">{errorMessage}</div>
            <Button
              onClick={() => setErrorMessage(null)}
              className="cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {globalTimer.isActive && (
          <div className="flex items-center gap-2 text-sm">
            <StopIcon
              className="w-4 h-4 text-red-400 cursor-pointer hover:text-red-300"
              onClick={stopTimer}
            />
            <div className="flex items-center gap-1 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="font-mono">{formatTimeDisplay(globalTimer.elapsedTime)}</span>
            </div>
            <div className="text-zinc-400">
              {globalTimer.lineContent
                ? globalTimer.lineContent.substring(0, STATUS_BAR_TRUNCATE_LENGTH) + '...'
                : globalTimer.lineContent}
            </div>
          </div>
        )}
      </div>
      <div className="text-sm text-zinc-400">lines: {doc.children.length}</div>
    </div>
  )
}
