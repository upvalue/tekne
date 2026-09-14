// TimerBadge.tsx - the per-line timer badge and its dialog shell. The timer
// engine itself lives in timer/timer-controller.ts; the per-mode dialog
// bodies live in timer/.
import * as React from 'react'
import { BadgeButton } from '@/components/vendor/Badge'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/vendor/Dialog'
import type { LineWithIdx } from './line-editor'
import {
  useDocLine,
  globalTimerAtom,
  notificationPermissionAtom,
  timerDialogRequestAtom,
  type TimerMode,
} from './state'
import { Button } from '@/components/vendor/Button'
import { Switch, SwitchField } from '@/components/vendor/Switch'
import { Clock } from 'lucide-react'
import { useAtom, useStore } from 'jotai'
import { renderTime } from '@/lib/time'
import { TimerInfo } from './TimerInfo'
import {
  cancelTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopAndSaveTimer,
} from './timer/timer-controller'
import { TimerModeStopwatch } from './timer/TimerModeStopwatch'
import { TimerModeCountdown } from './timer/TimerModeCountdown'
import { TimerModeManual } from './timer/TimerModeManual'
import { parseTime } from './timer/parse-time'
import { isIOS, isMobile } from '@/lib/platform'
import {
  enableTimerNotifications,
  supportsTimerNotifications,
} from './timer/timer-notifications'
import { toast } from 'sonner'

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
  const [open, setOpen] = React.useState(false)
  const [viewportStyle, setViewportStyle] = React.useState<React.CSSProperties>(
    {}
  )
  React.useEffect(() => {
    const viewport = window.visualViewport
    if (!open || !viewport) return
    const update = () =>
      setViewportStyle({
        '--timer-viewport-height': `${viewport.height}px`,
        '--timer-viewport-bottom': `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      } as React.CSSProperties)
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [open])
  const store = useStore()
  const [, setLine] = useDocLine(lineInfo.lineIdx)
  const [globalTimer, setGlobalTimer] = useAtom(globalTimerAtom)
  // Which tab the dialog shows. Pure view state, deliberately separate from
  // globalTimer.mode (the running timer's mode): browsing tabs must never
  // touch the engine, so switching tabs can't reset an active timer.
  const [viewMode, setViewMode] = React.useState<TimerMode>('stopwatch')
  const [notificationPermission, setNotificationPermission] = useAtom(
    notificationPermissionAtom
  )
  const [enablingNotifications, setEnablingNotifications] =
    React.useState(false)

  const isThisTimerActive =
    globalTimer.isActive &&
    globalTimer.lineTimeCreated === lineInfo.line.timeCreated
  const isAnyTimerActive = globalTimer.isActive

  const [timeInput, setTimeInput] = React.useState(renderTime(time))
  const [countdownInput, setCountdownInput] = React.useState('30m')
  const [timerDialogRequest, setTimerDialogRequest] = useAtom(
    timerDialogRequestAtom
  )

  // Handle programmatic dialog open requests (from command palette)
  React.useEffect(() => {
    if (timerDialogRequest && timerDialogRequest.lineIdx === lineInfo.lineIdx) {
      // Select the tab and open the dialog
      setViewMode(timerDialogRequest.mode)
      setOpen(true)
      // Clear the request
      setTimerDialogRequest(null)
    }
  }, [timerDialogRequest, lineInfo.lineIdx, setTimerDialogRequest])

  const requestNotificationPermission = React.useCallback(async () => {
    try {
      if (
        !isMobile &&
        notificationPermission === null &&
        'Notification' in window
      ) {
        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)
      }
    } catch (error) {
      console.error('Notification permission failed', error)
    }
  }, [notificationPermission, setNotificationPermission])

  const handleStart = React.useCallback(() => {
    if (viewMode === 'manual') return

    let targetDuration = store.get(globalTimerAtom).targetDuration
    if (viewMode === 'countdown') {
      const parsedDuration = parseTime(countdownInput)
      if (parsedDuration === null) return
      targetDuration = parsedDuration
    }
    void requestNotificationPermission()

    startTimer(store, {
      line: lineInfo.line,
      mode: viewMode,
      timeMode: store.get(globalTimerAtom).timeMode,
      targetDuration,
    })
    setOpen(false)
  }, [
    store,
    viewMode,
    countdownInput,
    lineInfo.line,
    requestNotificationPermission,
  ])

  const handleStop = React.useCallback(() => {
    stopAndSaveTimer(store)
  }, [store])

  const handlePause = React.useCallback(() => pauseTimer(store), [store])
  const handleResume = React.useCallback(() => resumeTimer(store), [store])

  const handleDiscard = React.useCallback(() => {
    if (isThisTimerActive) {
      cancelTimer(store)
    }
  }, [isThisTimerActive, store])

  const lineContent = lineInfo.line.mdContent

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (open) {
          // Land on the running timer's tab so its controls are in view
          if (isThisTimerActive) {
            setViewMode(globalTimer.mode)
          }
        }
        setOpen(open)
      }}
    >
      {/* flex, not block: a block wrapper gains a line-height strut taller
          than the badge, which breaks first-line centering */}
      <div className="ml-1 flex">
        <BadgeButton
          className="cursor-pointer whitespace-nowrap"
          badgeClassName="px-[4px] py-[1px]"
          onClick={() => {
            if (isThisTimerActive) setViewMode(globalTimer.mode)
            setOpen(true)
          }}
        >
          <div className="flex items-center gap-1">
            <Clock style={{ width: '16px', height: '16px' }} />
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
      <DialogContent
        style={viewportStyle}
        className="text-white flex flex-col left-1/2 top-auto bottom-[var(--timer-viewport-bottom,0px)] w-full max-w-full max-h-[calc(var(--timer-viewport-height,100dvh)*0.9)] translate-y-0 rounded-b-none overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-[32%] sm:top-[40%] sm:bottom-auto sm:w-96 sm:max-w-[calc(100%-2rem)] sm:max-h-[80dvh] sm:-translate-y-1/2 sm:rounded-lg sm:p-6"
      >
        <DialogHeader className="flex flex-col gap-4 text-left">
          <DialogTitle>Timer</DialogTitle>

          {/* Mode Selection */}
          <div className="flex justify-between items-center border-b border-gray-600 pb-2">
            <div className="grid grid-cols-3 gap-2 w-full">
              {(['stopwatch', 'countdown', 'manual'] as const).map((mode) => (
                <Button
                  key={mode}
                  {...(viewMode === mode
                    ? { color: 'sky' }
                    : { outline: true })}
                  onClick={() => setViewMode(mode)}
                  className="capitalize text-xs min-h-11 px-2 py-2"
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {/* Time Mode Selection */}
          <div className="border-b border-gray-600 pb-2">
            <SwitchField>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">
                    Time Entry Mode
                  </span>
                  <span className="text-xs text-gray-400">
                    {globalTimer.timeMode === 'additive'
                      ? 'Add to existing time'
                      : 'Replace existing time'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs ${globalTimer.timeMode === 'replacement' ? 'text-white' : 'text-gray-400'}`}
                  >
                    Replace
                  </span>
                  <Switch
                    checked={globalTimer.timeMode === 'additive'}
                    onCheckedChange={(checked) => {
                      setGlobalTimer((prev) => ({
                        ...prev,
                        timeMode: checked ? 'additive' : 'replacement',
                      }))
                    }}
                    color="sky"
                  />
                  <span
                    className={`text-xs ${globalTimer.timeMode === 'additive' ? 'text-white' : 'text-gray-400'}`}
                  >
                    Add
                  </span>
                </div>
              </div>
            </SwitchField>
          </div>
          <div className="text-sm text-gray-400 break-words max-h-24 overflow-y-auto">
            {lineContent}
          </div>
        </DialogHeader>
        <div className="text-primary flex flex-col gap-4 py-2">
          <div className="flex-1 flex flex-col justify-center">
            {viewMode === 'stopwatch' && (
              <TimerModeStopwatch
                globalTimer={globalTimer}
                isRunningHere={
                  isThisTimerActive && globalTimer.mode === 'stopwatch'
                }
                isAnyTimerActive={isAnyTimerActive}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onDiscard={handleDiscard}
              />
            )}

            {viewMode === 'countdown' && (
              <TimerModeCountdown
                globalTimer={globalTimer}
                isRunningHere={
                  isThisTimerActive && globalTimer.mode === 'countdown'
                }
                isAnyTimerActive={isAnyTimerActive}
                countdownInput={countdownInput}
                onCountdownInputChange={setCountdownInput}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onDiscard={handleDiscard}
              />
            )}

            {viewMode === 'manual' && (
              <TimerModeManual
                timeMode={globalTimer.timeMode}
                timeInput={timeInput}
                onTimeInputChange={setTimeInput}
                onSubmit={(duration) => {
                  setLine((line) => {
                    if (!line) return
                    if (globalTimer.timeMode === 'additive') {
                      line.datumTimeSeconds =
                        (line.datumTimeSeconds || 0) + duration
                    } else {
                      line.datumTimeSeconds = duration
                    }
                  })
                  setOpen(false)
                }}
              />
            )}
          </div>
        </div>
        {isMobile && viewMode !== 'manual' && (
          <div className="border-t border-zinc-700 pt-3 text-sm text-gray-400">
            {supportsTimerNotifications() ? (
              (notificationPermission ?? Notification.permission) ===
              'granted' ? (
                <p>
                  One notification when you start a timer. Tap it to return
                  here.
                </p>
              ) : (notificationPermission ?? Notification.permission) ===
                'denied' ? (
                <p>
                  Timer notifications are blocked. You can allow them in your
                  browser or app settings.
                </p>
              ) : (
                <Button
                  outline
                  className="w-full min-h-11"
                  disabled={enablingNotifications}
                  onClick={async () => {
                    setEnablingNotifications(true)
                    try {
                      setNotificationPermission(
                        await enableTimerNotifications()
                      )
                    } catch (error) {
                      console.error('Timer notification setup failed', error)
                      toast.error(
                        'Could not enable timer notifications. Try again.'
                      )
                    } finally {
                      setEnablingNotifications(false)
                    }
                  }}
                >
                  {enablingNotifications
                    ? 'Enabling notifications…'
                    : 'Enable timer notifications'}
                </Button>
              )
            ) : isIOS ? (
              <p>
                Add Tekne to your Home Screen and open it there to enable timer
                notifications.
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
