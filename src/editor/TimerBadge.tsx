import { useEffect, useState } from 'react'
import { useAtom, useAtomValue, useStore } from 'jotai'
import { Clock, ChevronDown, Pause, X } from 'lucide-react'
import type { LineWithIdx } from './line-editor'
import {
  docAtom,
  focusedLineAtom,
  globalTimerAtom,
  timerBusyAtom,
  timerRowRequestAtom,
} from './state'
import { Button } from '@/components/vendor/Button'
import { formatTimeDisplay, renderTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { parseTime } from './timer/parse-time'
import { useTimerTick } from './timer/useTimerTick'
import {
  cancelTimer,
  extendTimer,
  isTimerPaused,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopAndSaveTimer,
  timerElapsedSeconds,
  timerRemainingSeconds,
} from './timer/timer-controller'
import { toast } from 'sonner'
import {
  enableTimerNotifications,
  supportsTimerNotifications,
} from './timer/timer-notifications'

export const TimerBadge = ({
  lineInfo,
  time,
}: {
  lineInfo: LineWithIdx
  time: number
}) => {
  const store = useStore()
  const timer = useAtomValue(globalTimerAtom)
  const busy = useAtomValue(timerBusyAtom)
  const [request, setRequest] = useAtom(timerRowRequestAtom)
  const [open, setOpen] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [manual, setManual] = useState('')
  const runningHere = timer.isActive && timer.lineId === lineInfo.line.id
  const paused = isTimerPaused(timer)
  useTimerTick(runningHere && !paused)
  useEffect(() => {
    if (request?.lineIdx !== lineInfo.lineIdx) return
    setOpen(true)
    setRequest(null)
  }, [request, lineInfo.lineIdx, setRequest])
  const elapsed = timerElapsedSeconds(timer)
  const remaining = timerRemainingSeconds(timer)
  const start = (mode: 'stopwatch' | 'countdown', duration = 25 * 60) => {
    if (supportsTimerNotifications() && Notification.permission === 'default') {
      void enableTimerNotifications().catch(() => {})
    }
    void startTimer(store, {
      line: lineInfo.line,
      mode,
      timeMode: 'additive',
      targetDuration: duration,
    })
  }
  const log = (replace: boolean) => {
    const duration = parseTime(manual)
    if (duration === null) return
    const id = lineInfo.line.id
    const before = store
      .get(docAtom)
      .children.find((line) => line.id === id)?.datumTimeSeconds
    const next = replace ? duration : (before ?? 0) + duration
    store.set(docAtom, (draft) => {
      const line = draft.children.find((line) => line.id === id)
      if (line) {
        line.datumTimeSeconds = next
        line.timeUpdated = new Date().toISOString()
      }
    })
    setManual('')
    toast.success(
      `${replace ? 'Set total to' : 'Added'} ${renderTime(duration)}`,
      {
        action: {
          label: 'Undo',
          onClick: () =>
            store.set(docAtom, (draft) => {
              const line = draft.children.find((line) => line.id === id)
              if (line?.datumTimeSeconds !== next) return
              if (before === undefined) delete line.datumTimeSeconds
              else line.datumTimeSeconds = before
            }),
        },
      }
    )
  }
  const inputClass =
    'w-full min-w-0 rounded bg-white/5 px-2 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-accent'
  return (
    <>
      <div
        className={cn(
          'ELine-leading TimerChip mr-4 ml-2',
          !runningHere && time === 0 && !open && 'TimerChip-hover'
        )}
      >
        {runningHere || time > 0 ? (
          <button
            onClick={() => {
              store.set(focusedLineAtom, lineInfo.lineIdx)
              setOpen(!open)
            }}
            aria-label={`Time for line ${lineInfo.lineIdx + 1}`}
            aria-expanded={open}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-mono whitespace-nowrap',
              runningHere
                ? paused
                  ? 'bg-white/5 text-muted'
                  : 'bg-accent-tint text-accent'
                : 'text-muted hover:bg-white/5'
            )}
          >
            {runningHere ? (
              paused ? (
                <Pause size={11} />
              ) : (
                <span>●</span>
              )
            ) : (
              <Clock size={11} />
            )}
            {runningHere
              ? timer.mode === 'countdown'
                ? `${formatTimeDisplay(remaining)} left`
                : formatTimeDisplay(time + elapsed)
              : renderTime(time)}
          </button>
        ) : (
          <div className="flex rounded bg-white/5 text-muted text-xs whitespace-nowrap">
            <button
              className="px-2 py-1 hover:text-text"
              disabled={busy}
              onClick={() => start('stopwatch')}
            >
              ▶ Stopwatch
            </button>
            <button
              className="px-1 hover:text-text"
              aria-label={`Open timer row for line ${lineInfo.lineIdx + 1}`}
              aria-expanded={open}
              onClick={() => {
                store.set(focusedLineAtom, lineInfo.lineIdx)
                setOpen(!open)
              }}
            >
              <ChevronDown size={12} />
            </button>
          </div>
        )}
      </div>
      {open && (
        <section
          className="TimerRow relative rounded-lg bg-raised p-4 mt-2 mb-3 overflow-hidden"
          aria-label={`Timer for line ${lineInfo.lineIdx + 1}`}
        >
          <button
            aria-label="Close timer row"
            className="absolute right-3 top-3 text-muted hover:text-text"
            onClick={() => setOpen(false)}
          >
            <X size={14} />
          </button>
          <fieldset disabled={busy} className="min-w-0">
            {runningHere ? (
              <>
                <div className="text-xs text-text-2 mb-2">
                  {timer.mode === 'countdown'
                    ? `Countdown · ${renderTime(timer.targetDuration)}`
                    : 'Stopwatch'}
                  {paused && ' · Paused'}
                </div>
                <div className="font-mono text-3xl text-accent">
                  {formatTimeDisplay(
                    timer.mode === 'countdown' ? remaining : elapsed
                  )}
                </div>
                <p className="text-xs text-muted mt-2 mb-4">
                  {timer.mode === 'countdown' &&
                    !paused &&
                    `Ends at ${new Date(Date.now() + remaining * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · `}
                  {renderTime(time)} logged before
                </p>
                <div className="flex flex-wrap gap-2">
                  {timer.mode === 'countdown' && (
                    <Button onClick={() => void extendTimer(store)}>+5m</Button>
                  )}
                  <Button
                    onClick={() =>
                      void (paused ? resumeTimer(store) : pauseTimer(store))
                    }
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    color="accent"
                    onClick={() => void stopAndSaveTimer(store, 'additive')}
                  >
                    Stop · add {formatTimeDisplay(elapsed)}
                  </Button>
                  {time > 0 && (
                    <Button
                      onClick={() =>
                        void stopAndSaveTimer(store, 'replacement', time)
                      }
                    >
                      Stop · replace {renderTime(time)}
                    </Button>
                  )}
                  <Button plain onClick={() => void cancelTimer(store)}>
                    Discard
                  </Button>
                </div>
                {timer.mode === 'countdown' && (
                  <div
                    className="absolute bottom-0 left-0 h-[3px] bg-accent-fill"
                    style={{
                      width: `${Math.min(100, (elapsed / timer.targetDuration) * 100)}%`,
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <div className="text-xs text-muted mb-4">
                  <span className="font-mono text-text-2">
                    {renderTime(time)}
                  </span>{' '}
                  logged on this line
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <h3 className="text-sm mb-3">Stopwatch</h3>
                    <Button color="accent" onClick={() => start('stopwatch')}>
                      Start
                    </Button>
                  </div>
                  <div>
                    <h3 className="text-sm mb-3">Countdown</h3>
                    <div className="flex gap-1 mb-2">
                      {[15, 25, 50].map((minutes) => (
                        <Button
                          key={minutes}
                          className="px-2"
                          onClick={() => start('countdown', minutes * 60)}
                        >
                          {minutes}m
                        </Button>
                      ))}
                    </div>
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const duration = parseTime(countdown)
                        if (duration !== null && duration > 0)
                          start('countdown', duration)
                      }}
                    >
                      <input
                        aria-label="Countdown length"
                        className={inputClass}
                        placeholder="25m"
                        value={countdown}
                        onChange={(e) => setCountdown(e.target.value)}
                      />
                      <Button type="submit" disabled={!parseTime(countdown)}>
                        Start
                      </Button>
                    </form>
                  </div>
                  <div>
                    <h3 className="text-sm mb-3">Enter time</h3>
                    <input
                      aria-label="Time to log"
                      className={inputClass}
                      placeholder="45m, 1h 20m"
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') log(false)
                      }}
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Button
                        disabled={parseTime(manual) === null}
                        onClick={() => log(false)}
                      >
                        Add
                      </Button>
                      <Button
                        disabled={parseTime(manual) === null}
                        onClick={() => log(true)}
                      >
                        Set total
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </fieldset>
        </section>
      )}
    </>
  )
}
