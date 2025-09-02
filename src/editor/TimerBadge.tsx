import * as React from 'react'
import { BadgeButton } from '@/components/vendor/Badge'

import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@/components/vendor/Dialog'
import type { LineWithIdx } from './line-editor'
import { useDocLine, globalTimerAtom, notificationPermissionAtom } from './state'
import { Input } from '@/components/vendor/Input'
import parseDuration from 'parse-duration'
import { Button } from '@/components/vendor/Button'
import { DialogClose } from '@radix-ui/react-dialog'
import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/16/solid'
import { useCallback, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { setDetailTitle } from '@/lib/title'
import { trpc } from '@/trpc/client'

const useEventListener = (event: string, handler: (event: Event) => void) => {
  React.useEffect(() => {
    window.addEventListener(event, handler)
    return () => window.removeEventListener(event, handler)
  }, [event, handler])
}

const renderTime = (seconds: number) => {
  if (seconds === 0) return '0s'

  const days = Math.floor(seconds / (24 * 60 * 60))
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)
  const remainingSeconds = seconds % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (remainingSeconds > 0 && parts.length === 0)
    parts.push(`${remainingSeconds}s`)

  return parts.join(' ')
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

const parseTime = (time: string) => parseDuration(time, 's')

/**
 * Timer badge; shows time spent and allows user to interact
 * with the timer
 */
export const TimerBadge = ({
  lineInfo,
  time,
}: {
  lineInfo: LineWithIdx
  time: number
}) => {

  const execHook = trpc.execHook.useMutation();
  const [, setLine] = useDocLine(lineInfo.lineIdx)
  const [globalTimer, setGlobalTimer] = useAtom(globalTimerAtom)
  const [notificationPermission, setNotificationPermission] = useAtom(notificationPermissionAtom)

  const isThisTimerActive = globalTimer.isActive && globalTimer.lineIdx === lineInfo.lineIdx
  const isAnyTimerActive = globalTimer.isActive

  const [timeInput, setTimeInput] = React.useState(renderTime(time))
  const [countdownInput, setCountdownInput] = React.useState('25m')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const requestNotificationPermission = useCallback(async () => {
    if (notificationPermission === null && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }, [notificationPermission, setNotificationPermission])

  const sendNotification = useCallback((message: string) => {
    if (notificationPermission === 'granted' && 'Notification' in window) {
      new Notification('Timer Complete', {
        body: message,
        icon: '/favicon/tekne32-emerald.png'
      })
    }
  }, [notificationPermission])

  const lineContent = lineInfo.line.mdContent;

  const startTimer = useCallback(() => {
    if (isAnyTimerActive && !isThisTimerActive) {
      return
    }

    const mode = globalTimer.mode
    const targetDuration = globalTimer.targetDuration

    setGlobalTimer({
      isActive: true,
      lineIdx: lineInfo.lineIdx,
      lineContent: lineContent,
      mode,
      startTime: Date.now(),
      targetDuration,
      elapsedTime: mode === 'countdown' ? targetDuration : 0,
    })

    setDetailTitle(lineContent)

    intervalRef.current = setInterval(() => {
      setGlobalTimer(prev => {
        if (!prev.isActive) return prev

        const now = Date.now()
        const elapsed = Math.floor((now - (prev.startTime || now)) / 1000)

        if (prev.mode === 'stopwatch') {
          return { ...prev, elapsedTime: elapsed }
        } else if (prev.mode === 'countdown') {
          const remaining = Math.max(0, prev.targetDuration - elapsed)
          if (remaining === 0) {
            clearInterval(intervalRef.current!)
            setLine((line) => {
              line.datumTime = (line.datumTime || 0) + prev.targetDuration
            })
            sendNotification(`Timer completed for: ${prev.lineContent}`)
            setDetailTitle(null)
            return { ...prev, isActive: false, elapsedTime: 0, startTime: null, lineIdx: null, lineContent: null }
          }
          return { ...prev, elapsedTime: remaining }
        }
        return prev
      })
    }, 1000)

    execHook.mutate({
      hook: 'timer-start', argument: {
        line: lineInfo.line.mdContent,
      }
    })
  }, [lineContent, execHook, lineInfo.line.mdContent, setLine, globalTimer, setGlobalTimer, isAnyTimerActive, isThisTimerActive, lineInfo.lineIdx, sendNotification])

  const stopTimer = useCallback(() => {
    if (!isThisTimerActive) return

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    execHook.mutate({
      hook: 'timer-stop', argument: {
        line: lineInfo.line.mdContent,
      }
    })

    setDetailTitle(null)

    if (globalTimer.mode === 'stopwatch') {
      const finalElapsed = globalTimer.startTime ? Math.floor((Date.now() - globalTimer.startTime) / 1000) : globalTimer.elapsedTime
      setLine((line) => {
        line.datumTime = finalElapsed
      })
    } else if (globalTimer.mode === 'countdown') {
      const timeWorked = globalTimer.startTime ? Math.floor((Date.now() - globalTimer.startTime) / 1000) : 0
      setLine((line) => {
        line.datumTime = Math.min(timeWorked, globalTimer.targetDuration)
      })
    }

    setGlobalTimer({
      isActive: false,
      lineIdx: null,
      lineContent: null,
      mode: 'stopwatch',
      startTime: null,
      targetDuration: 25 * 60,
      elapsedTime: 0,
    })
  }, [setLine, execHook, lineInfo.line.mdContent, isThisTimerActive, globalTimer, setGlobalTimer])

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (isThisTimerActive) {
      setGlobalTimer(prev => ({
        ...prev,
        isActive: false,
        elapsedTime: 0,
        startTime: null,
        lineIdx: null,
        lineContent: null,
      }))
    }
  }, [isThisTimerActive, setGlobalTimer])

  React.useEffect(() => {
    const duration = parseTime(timeInput)
    if (duration !== null) {
      setLine((line) => {
        line.datumTime = duration
      })
    }
  }, [timeInput, setLine])

  React.useEffect(() => {
    const duration = parseTime(countdownInput)
    if (duration !== null) {
      setGlobalTimer(prev => ({
        ...prev,
        targetDuration: duration,
      }))
    }
  }, [countdownInput, setGlobalTimer])

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
    if (globalTimer.isActive) {
      event.preventDefault()
      event.returnValue = 'You have an active timer running. Are you sure you want to leave?'
    }
  })

  const displayTime = isThisTimerActive ? globalTimer.elapsedTime : time

  return (
    <Dialog onOpenChange={(open) => {
      if (open) {
        requestNotificationPermission()
      }
    }}>
      <DialogTrigger asChild>
        <div className="ml-1">
          <BadgeButton
            className="cursor-pointer whitespace-nowrap"
            badgeClassName="px-[4px] py-[1px]"
          >
            <div className="flex items-center gap-1">
              <ClockIcon style={{ width: '16px', height: '16px' }} />
              {(time > 0 || isThisTimerActive) && (
                <div className={isThisTimerActive ? 'text-green-400' : ''}>
                  {isThisTimerActive ? formatTimeDisplay(displayTime) : renderTime(time)}
                </div>
              )}
              {isThisTimerActive && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
          </BadgeButton>
        </div>
      </DialogTrigger>
      <DialogOverlay>
        <DialogContent className="text-white w-96 h-[500px]">
          <DialogHeader className="flex flex-col gap-2">
            <DialogTitle>Timer</DialogTitle>

            {/* Mode Selection */}
            <div className="flex justify-between items-center border-b border-gray-600 pb-2">
              <div className="flex gap-2">
                {(['stopwatch', 'countdown', 'manual'] as const).map((mode) => (
                  <Button
                    key={mode}
                    {...(globalTimer.mode === mode ? { color: 'indigo' } : { outline: true })}
                    onClick={() => {
                      resetTimer()
                      setGlobalTimer(prev => ({ ...prev, mode }))
                    }}
                    className="capitalize text-xs px-3 py-1"
                    disabled={isAnyTimerActive && !isThisTimerActive}
                  >
                    {mode}
                  </Button>
                ))}
              </div>

            </div>
            <div className="text-lg text-gray-400">{lineContent}</div>
          </DialogHeader>
          <div className="text-primary flex flex-col gap-4 h-full overflow-hidden">


            {/* Timer Content - Fixed height container */}
            <div className="flex-1 flex flex-col justify-center">
              {/* Stopwatch Mode */}
              {globalTimer.mode === 'stopwatch' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-mono mb-2">
                      {formatTimeDisplay(isThisTimerActive ? globalTimer.elapsedTime : 0)}
                    </div>
                    <div className="text-sm text-gray-400">
                      Stopwatch Mode - Counts up from zero.
                    </div>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {!isThisTimerActive ? (
                      <Button
                        onClick={startTimer}
                        className="flex items-center gap-2"
                        disabled={isAnyTimerActive}
                      >
                        <PlayIcon className="w-4 h-4" />
                        {isAnyTimerActive ? 'Timer Active Elsewhere' : 'Start'}
                      </Button>
                    ) : (
                      <Button onClick={stopTimer} className="flex items-center gap-2">
                        <StopIcon className="w-4 h-4" />
                        Stop & Save
                      </Button>
                    )}
                    <Button onClick={resetTimer} outline disabled={!isThisTimerActive}>
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              {/* Countdown Mode */}
              {globalTimer.mode === 'countdown' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-mono mb-2">
                      {formatTimeDisplay(isThisTimerActive ? globalTimer.elapsedTime : globalTimer.targetDuration)}
                    </div>
                    <div className="text-sm text-gray-400">
                      Countdown Mode - Counts down to zero.
                    </div>
                  </div>
                  {!isThisTimerActive && (
                    <div className="space-y-3">
                      <label className="text-sm text-gray-400">Set Duration:</label>
                      <Input
                        type="text"
                        value={countdownInput}
                        onChange={(e) => setCountdownInput(e.target.value)}
                        placeholder="e.g., 25m, 1h 30m"
                        className="w-full"
                        disabled={isAnyTimerActive}
                      />
                      {parseTime(countdownInput) === null && countdownInput && (
                        <div className="text-red-400 text-sm">
                          Unable to parse duration. Try: 25m, 1h 30m, etc.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 justify-center">
                    {!isThisTimerActive ? (
                      <Button
                        onClick={startTimer}
                        className="flex items-center gap-2"
                        disabled={isAnyTimerActive}
                      >
                        <PlayIcon className="w-4 h-4" />
                        {isAnyTimerActive ? 'Timer Active Elsewhere' : 'Start Countdown'}
                      </Button>
                    ) : (
                      <Button onClick={stopTimer} className="flex items-center gap-2">
                        <StopIcon className="w-4 h-4" />
                        Stop
                      </Button>
                    )}
                    <Button onClick={resetTimer} outline disabled={!isThisTimerActive}>
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              {/* Manual Mode */}
              {globalTimer.mode === 'manual' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-2xl font-mono mb-2 text-gray-400">
                      Manual Entry
                    </div>
                    <div className="text-sm text-gray-400">
                      Enter time directly without running a timer. <br />
                      Replaces existing time.
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Enter Time:</label>
                      <Input
                        type="text"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        placeholder="e.g., 2h 30m, 45m, 1h"
                      />
                      {parseTime(timeInput) === null && timeInput && (
                        <div className="text-red-400 text-sm">
                          Unable to parse duration. Try: 2h 30m, 45m, etc.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </DialogOverlay>
    </Dialog>
  )
}
