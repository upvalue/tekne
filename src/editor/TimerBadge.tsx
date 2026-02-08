// TimerBadge.tsx - in addition to the badge, contains a lot of
// the timer management code.
import * as React from 'react'
import { BadgeButton } from '@/components/vendor/Badge'

import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogOverlay,
  DialogTitle,
} from '@/components/vendor/Dialog'
import type { LineWithIdx } from './line-editor'
import {
  useDocLine,
  globalTimerAtom,
  notificationPermissionAtom,
  docAtom,
  setDocLineDirect,
  timerDialogRequestAtom,
  DEFAULT_COUNTDOWN_SECONDS,
} from './state'
import { Input } from '@/components/vendor/Input'
import parseDuration from 'parse-duration'
import { Button } from '@/components/vendor/Button'
import { Switch, SwitchField } from '@/components/vendor/Switch'
import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/16/solid'
import { useCallback } from 'react'
import { useAtom, useAtomValue, useStore } from 'jotai'
import { setDetailTitle, setTimerActive } from '@/lib/title'
import { formatTimeDisplay, renderTime } from '@/lib/time'
import { trpc } from '@/trpc/client'
import { useEventListener } from '@/hooks/useEventListener'
import { EditorDialogContent } from '@/components/EditorDialogContent'
import { noop } from 'lodash-es'
import { TimerInfo } from './TimerInfo'

const parseTime = (time: string) => parseDuration(time, 's')

const stopTimer = (store: ReturnType<typeof useStore>, execHook: ReturnType<typeof trpc.execHook.useMutation>, lineIdx: number) => {
  return () => {
    const globalTimer = store.get(globalTimerAtom)
    const doc = store.get(docAtom);
    const line = doc.children[lineIdx];

    if (globalTimer.interval) {
      clearInterval(globalTimer.interval)
    }

    execHook.mutate({
      hook: 'timer-stop',
      argument: {
        doc,
        line: line.mdContent,
        lineIdx,
      },
    })

    setDetailTitle(null)
    setTimerActive(false)

    if (globalTimer.mode === 'stopwatch') {
      const finalElapsed = globalTimer.startTime
        ? Math.floor((Date.now() - globalTimer.startTime) / 1000)
        : 0
      setDocLineDirect(store, lineIdx, (line) => {
        if (globalTimer.timeMode === 'additive') {
          line.datumTimeSeconds = (line.datumTimeSeconds || 0) + finalElapsed
        } else {
          line.datumTimeSeconds = finalElapsed
        }
      })
    } else if (globalTimer.mode === 'countdown') {
      const timeWorked = globalTimer.startTime
        ? Math.floor((Date.now() - globalTimer.startTime) / 1000)
        : 0
      setDocLineDirect(store, lineIdx, (line) => {
        if (globalTimer.timeMode === 'additive') {
          line.datumTimeSeconds = (line.datumTimeSeconds || 0) + Math.min(timeWorked, globalTimer.targetDuration)
        } else {
          line.datumTimeSeconds = Math.min(timeWorked, globalTimer.targetDuration)
        }
      })
    }

    store.set(globalTimerAtom, {
      isActive: false,
      lineIdx: null,
      lineContent: null,
      mode: 'stopwatch',
      timeMode: 'replacement',
      startTime: null,
      targetDuration: DEFAULT_COUNTDOWN_SECONDS,
      tick: 0,
      stopTimer: noop,
      interval: null,
    })
  }
}

/**
 * Timer badge; shows time spent and allows user to control
 * the global timer state
 */
export const TimerBadge = ({
  lineInfo,
  time,
}: {
  lineInfo: LineWithIdx
  time: number
}) => {
  const execHook = trpc.execHook.useMutation()
  const [open, setOpen] = React.useState(false)
  const doc = useAtomValue(docAtom)
  const store = useStore();
  const [, setLine] = useDocLine(lineInfo.lineIdx)
  const [globalTimer, setGlobalTimer] = useAtom(globalTimerAtom)
  const [notificationPermission, setNotificationPermission] = useAtom(
    notificationPermissionAtom
  )

  const isThisTimerActive =
    globalTimer.isActive && globalTimer.lineIdx === lineInfo.lineIdx
  const isAnyTimerActive = globalTimer.isActive

  const [timeInput, setTimeInput] = React.useState(renderTime(time))
  const [countdownInput, setCountdownInput] = React.useState('30m')
  const [timerDialogRequest, setTimerDialogRequest] = useAtom(timerDialogRequestAtom)

  // Handle programmatic dialog open requests (from command palette)
  React.useEffect(() => {
    if (timerDialogRequest && timerDialogRequest.lineIdx === lineInfo.lineIdx) {
      // Set the mode and open the dialog
      setGlobalTimer((prev) => ({ ...prev, mode: timerDialogRequest.mode }))
      setOpen(true)
      // Clear the request
      setTimerDialogRequest(null)
    }
  }, [timerDialogRequest, lineInfo.lineIdx, setGlobalTimer, setTimerDialogRequest])

  const requestNotificationPermission = useCallback(async () => {
    if (notificationPermission === null && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }, [notificationPermission, setNotificationPermission])

  const sendNotification = useCallback(
    (message: string) => {
      if (notificationPermission === 'granted' && 'Notification' in window) {
        new Notification('Timer Complete', {
          body: message,
          icon: '/favicon/tekne32-sky.png',
        })
      }
    },
    [notificationPermission]
  )

  const lineContent = lineInfo.line.mdContent

  const startTimer = useCallback(() => {
    if (isAnyTimerActive && !isThisTimerActive) {
      return
    }

    const mode = globalTimer.mode
    let targetDuration = globalTimer.targetDuration

    // For countdown mode, parse the user input and use it as the target duration
    if (mode === 'countdown') {
      const parsedDuration = parseTime(countdownInput)
      if (parsedDuration === null) {
        // Don't start timer with invalid duration
        return
      }
      targetDuration = parsedDuration
    }

    setDetailTitle(lineContent)
    setTimerActive(true)

    const interval = setInterval(() => {
      const globalTimer = store.get(globalTimerAtom)

      if (globalTimer.mode === 'stopwatch') {
        setGlobalTimer(prev => ({ ...prev, tick: prev.tick + 1 }))
      } else if (globalTimer.mode === 'countdown') {
        const elapsed = globalTimer.startTime
          ? Math.floor((Date.now() - globalTimer.startTime) / 1000)
          : 0
        const remaining = Math.max(0, globalTimer.targetDuration - elapsed)
        if (remaining === 0) {
          sendNotification(`Timer completed for: ${globalTimer.lineContent}`)
          const { stopTimer } = globalTimer;
          if (stopTimer) {
            stopTimer()
          }
        } else {
          setGlobalTimer(prev => ({ ...prev, tick: prev.tick + 1 }))
        }
      }
    }, 1000)

    setGlobalTimer({
      isActive: true,
      lineIdx: lineInfo.lineIdx,
      lineContent: lineContent,
      mode,
      timeMode: globalTimer.timeMode,
      startTime: Date.now(),
      targetDuration,
      tick: 0,
      stopTimer: stopTimer(store, execHook, lineInfo.lineIdx),
      interval,
    })

    execHook.mutate({
      hook: 'timer-start',
      argument: {
        doc,
        line: lineInfo.line.mdContent,
        lineIdx: lineInfo.lineIdx,
      },
    })

    setOpen(false)
  }, [
    doc,
    lineContent,
    execHook,
    lineInfo.line.mdContent,
    globalTimer,
    setGlobalTimer,
    store,
    isAnyTimerActive,
    isThisTimerActive,
    lineInfo.lineIdx,
    sendNotification,
    countdownInput,
    setLine,
    setOpen,
  ])

  const callStopTimer = useCallback(() => {
    globalTimer.stopTimer();
  }, [globalTimer.stopTimer])

  const resetTimer = useCallback(() => {
    if (isThisTimerActive) {
      globalTimer.stopTimer()
    }
  }, [isThisTimerActive, globalTimer])

  useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
    console.log('unload gotten');
    if (globalTimer.isActive) {
      event.preventDefault()
      event.returnValue = true;
      'You have an active timer running. Are you sure you want to leave?'
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (open) {
          requestNotificationPermission()
        }
        setOpen(open)
      }}
    >
      <DialogTrigger asChild>
        <div className="ml-1">
          <BadgeButton
            className="cursor-pointer whitespace-nowrap"
            badgeClassName="px-[4px] py-[1px]"
            onClick={() => setOpen(true)}
          >
            <div className="flex items-center gap-1">
              <ClockIcon style={{ width: '16px', height: '16px' }} />
              {(time > 0 || isThisTimerActive) && (
                <TimerInfo
                  baseTime={time}
                  globalTimer={globalTimer}
                  isThisTimer={isThisTimerActive}
                  className={isThisTimerActive ? 'text-green-400' : ''}
                />
              )}
              {isThisTimerActive && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
          </BadgeButton>
        </div>
      </DialogTrigger>
      <DialogOverlay>
        <EditorDialogContent className="text-white w-96 h-[500px]">
          <DialogHeader className="flex flex-col gap-4">
            <DialogTitle>Timer</DialogTitle>

            {/* Mode Selection */}
            <div className="flex justify-between items-center border-b border-gray-600 pb-2">
              <div className="flex gap-2">
                {(['stopwatch', 'countdown', 'manual'] as const).map((mode) => (
                  <Button
                    key={mode}
                    {...(globalTimer.mode === mode
                      ? { color: 'sky' }
                      : { outline: true })}
                    onClick={() => {
                      resetTimer()
                      setGlobalTimer((prev) => ({ ...prev, mode }))
                      // Reset countdown input when switching to countdown mode
                      if (mode === 'countdown') {
                        setCountdownInput('30m')
                      }
                    }}
                    className="capitalize text-xs px-3 py-1"
                    disabled={isAnyTimerActive && !isThisTimerActive}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </div>

            {/* Time Mode Selection */}
            <div className="border-b border-gray-600 pb-2">
              <SwitchField>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">Time Entry Mode</span>
                    <span className="text-xs text-gray-400">
                      {globalTimer.timeMode === 'additive' ? 'Add to existing time' : 'Replace existing time'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${globalTimer.timeMode === 'replacement' ? 'text-white' : 'text-gray-400'}`}>
                      Replace
                    </span>
                    <Switch
                      checked={globalTimer.timeMode === 'additive'}
                      onChange={(checked) => {
                        setGlobalTimer((prev) => ({
                          ...prev,
                          timeMode: checked ? 'additive' : 'replacement'
                        }))
                      }}
                      color="sky"
                    />
                    <span className={`text-xs ${globalTimer.timeMode === 'additive' ? 'text-white' : 'text-gray-400'}`}>
                      Add
                    </span>
                  </div>
                </div>
              </SwitchField>
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
                      {formatTimeDisplay(
                        isThisTimerActive && globalTimer.startTime
                          ? Math.floor((Date.now() - globalTimer.startTime) / 1000)
                          : 0
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      Stopwatch Mode - counts up.
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
                      <Button
                        onClick={callStopTimer}
                        className="flex items-center gap-2"
                      >
                        <StopIcon className="w-4 h-4" />
                        Stop & Save
                      </Button>
                    )}
                    <Button
                      onClick={resetTimer}
                      outline
                      disabled={!isThisTimerActive}
                    >
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
                      {formatTimeDisplay(
                        isThisTimerActive && globalTimer.startTime
                          ? Math.max(0, globalTimer.targetDuration - Math.floor((Date.now() - globalTimer.startTime) / 1000))
                          : parseTime(countdownInput) || globalTimer.targetDuration
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      Countdown Mode - Counts down to zero.
                    </div>
                  </div>
                  {!isThisTimerActive && (
                    <div className="space-y-3">
                      <label className="text-sm text-gray-400">
                        Set Duration:
                      </label>
                      <Input
                        autoFocus
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
                        disabled={isAnyTimerActive || parseTime(countdownInput) === null}
                      >
                        <PlayIcon className="w-4 h-4" />
                        {isAnyTimerActive
                          ? 'Timer Active Elsewhere'
                          : 'Start'}
                      </Button>
                    ) : (
                      <Button
                        onClick={callStopTimer}
                        className="flex items-center gap-2"
                      >
                        <StopIcon className="w-4 h-4" />
                        Stop
                      </Button>
                    )}
                    <Button
                      onClick={resetTimer}
                      outline
                      disabled={!isThisTimerActive}
                    >
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
                      {globalTimer.timeMode === 'additive' ? 'Adds to existing time.' : 'Replaces existing time.'}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">
                        Enter Time:
                      </label>
                      <Input
                        autoFocus
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
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const duration = parseTime(timeInput)
                          if (duration !== null) {
                            setLine((line) => {
                              if (!line) return;
                              if (globalTimer.timeMode === 'additive') {
                                line.datumTimeSeconds = (line.datumTimeSeconds || 0) + duration
                              } else {
                                line.datumTimeSeconds = duration
                              }
                            })
                          }
                          setOpen(false);
                        }}
                        disabled={parseTime(timeInput) === null}
                        color="sky"
                        className="flex-1"
                      >
                        {globalTimer.timeMode === 'additive' ? 'Add Time' : 'Set Time'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </EditorDialogContent>
      </DialogOverlay>
    </Dialog>
  )
}
