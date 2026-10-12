import { useEffect, useState } from 'react'
import { useAtom, useAtomValue, useStore } from 'jotai'
import {
  Clock,
  MoreHorizontal,
  Pause,
  Play,
  Square,
  X,
  Pin,
  CheckSquare,
  ChevronRight,
  Timer,
  Pencil,
} from 'lucide-react'
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
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@/components/vendor/Popover'
import { toggleTask, togglePin, toggleCollapse } from './line-ops'
import { displayKey, keybindings } from '@/lib/keys'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<'stopwatch' | 'countdown' | 'manual'>(
    'stopwatch'
  )
  const [countdown, setCountdown] = useState('')
  const [manual, setManual] = useState('')
  const runningHere = timer.isActive && timer.lineId === lineInfo.line.id
  const paused = isTimerPaused(timer)
  useTimerTick(runningHere && !paused)
  useEffect(() => {
    if (request?.lineIdx !== lineInfo.lineIdx) return
    setMode(request.mode)
    setOpen(true)
    setRequest(null)
  }, [request, lineInfo.lineIdx, setRequest])
  const elapsed = timerElapsedSeconds(timer)
  const remaining = timerRemainingSeconds(timer)
  const start = (mode: 'stopwatch' | 'countdown', duration = 25 * 60) => {
    if (supportsTimerNotifications() && Notification.permission === 'default') {
      void enableTimerNotifications().catch(() => {})
    }
    setMenuOpen(false)
    setOpen(false)
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
    'w-24 min-w-0 rounded bg-page px-2 py-1 text-sm tabular-nums outline-none focus:ring-1 focus:ring-accent'
  const openMode = (next: typeof mode) => {
    store.set(focusedLineAtom, lineInfo.lineIdx)
    setMode(next)
    setOpen(true)
    setMenuOpen(false)
  }
  const paletteKey = displayKey(keybindings.commandPalette)
  const menuItem =
    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text-2 hover:bg-white/5 focus:bg-white/5 outline-none'
  return (
    <>
      {(runningHere || time > 0) && (
        <div
          className={cn(
            'ELine-leading TimerChip ml-2 text-xs tabular-nums gap-1 whitespace-nowrap',
            runningHere && 'TimerChip-active'
          )}
        >
          <button
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5',
              runningHere
                ? 'text-accent bg-accent-tint'
                : 'text-muted hover:bg-white/5'
            )}
            aria-label={`Time for line ${lineInfo.lineIdx + 1}`}
            onClick={() => openMode(runningHere ? timer.mode : 'manual')}
          >
            <Clock size={12} />
            {runningHere
              ? timer.mode === 'countdown'
                ? `${formatTimeDisplay(remaining)} left`
                : formatTimeDisplay(elapsed)
              : renderTime(time)}
          </button>
          {runningHere && (
            <>
              <button
                disabled={busy}
                aria-label={paused ? 'Resume timer' : 'Pause timer'}
                title={`${paused ? 'Resume' : 'Pause'} (${displayKey(keybindings.toggleStopwatch)})`}
                className="p-1 text-muted hover:text-text"
                onClick={() =>
                  void (paused ? resumeTimer(store) : pauseTimer(store))
                }
              >
                {paused ? <Play size={13} /> : <Pause size={13} />}
              </button>
              <button
                disabled={busy}
                aria-label="Stop and save timer"
                title="Stop and add time"
                className="p-1 text-muted hover:text-text"
                onClick={() => void stopAndSaveTimer(store, 'additive')}
              >
                <Square size={12} />
              </button>
              {time > 0 && (
                <span className="text-muted">· {renderTime(time)} logged</span>
              )}
            </>
          )}
        </div>
      )}
      <div className={cn('LineActions', menuOpen && 'LineActions-open')}>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverButton
            aria-label={`Actions for line ${lineInfo.lineIdx + 1}`}
            title="Line actions"
            className="rounded p-1 text-muted hover:text-text hover:bg-white/5"
            onClick={() => store.set(focusedLineAtom, lineInfo.lineIdx)}
          >
            <MoreHorizontal size={16} />
          </PopoverButton>
          <PopoverPanel
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
                return
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  'button:not(:disabled)'
                )
              )
              const index = items.indexOf(
                document.activeElement as HTMLButtonElement
              )
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (index +
                        (event.key === 'ArrowDown' ? 1 : -1) +
                        items.length) %
                      items.length
              event.preventDefault()
              items[next]?.focus()
            }}
            align="start"
            sideOffset={4}
            aria-label={`Actions for line ${lineInfo.lineIdx + 1}`}
            className="OverlaySurface LineActionMenu w-72 p-2 text-text"
          >
            <button
              className={menuItem}
              onClick={() => {
                toggleTask(store, lineInfo.lineIdx)
                setMenuOpen(false)
              }}
            >
              <CheckSquare size={15} />
              {lineInfo.line.datumTaskStatus ? 'Remove task' : 'Make task'}
              <kbd className="ml-auto text-xs text-muted">{paletteKey} C</kbd>
            </button>
            <button
              className={menuItem}
              onClick={() => {
                togglePin(store, lineInfo.lineIdx)
                setMenuOpen(false)
              }}
            >
              <Pin size={15} />
              {lineInfo.line.datumPinnedAt ? 'Unpin' : 'Pin'}
              <kbd className="ml-auto text-xs text-muted">{paletteKey} P</kbd>
            </button>
            <button
              className={menuItem}
              onClick={() => {
                toggleCollapse(store, lineInfo.lineIdx)
                setMenuOpen(false)
              }}
            >
              <ChevronRight size={15} />
              {lineInfo.line.collapsed ? 'Expand' : 'Collapse'}
              <kbd className="ml-auto text-xs text-muted">
                {displayKey(keybindings.toggleCollapse)}
              </kbd>
            </button>
            <div className="my-2 mx-2 h-px bg-white/7" />
            {runningHere ? (
              <>
                <button
                  disabled={busy}
                  className={menuItem}
                  onClick={() => {
                    void (paused ? resumeTimer(store) : pauseTimer(store))
                    setMenuOpen(false)
                  }}
                >
                  <Pause size={15} />
                  {paused ? 'Resume timer' : 'Pause timer'}
                  <kbd className="ml-auto text-xs text-muted">
                    {displayKey(keybindings.toggleStopwatch)}
                  </kbd>
                </button>
                {timer.mode === 'countdown' && (
                  <button
                    disabled={busy}
                    className={menuItem}
                    onClick={() => void extendTimer(store)}
                  >
                    Add 5 minutes
                  </button>
                )}
                <button
                  disabled={busy}
                  className={menuItem}
                  onClick={() => {
                    void stopAndSaveTimer(store, 'additive')
                    setMenuOpen(false)
                  }}
                >
                  <Square size={15} />
                  Stop and add time
                </button>
                {time > 0 && (
                  <button
                    disabled={busy}
                    className={menuItem}
                    onClick={() => {
                      void stopAndSaveTimer(store, 'replacement', time)
                      setMenuOpen(false)
                    }}
                  >
                    Stop and replace {renderTime(time)}
                  </button>
                )}
                <button
                  disabled={busy}
                  className={menuItem}
                  onClick={() => {
                    void cancelTimer(store)
                    setMenuOpen(false)
                  }}
                >
                  <X size={15} />
                  Discard timer
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={busy}
                  className={menuItem}
                  onClick={() => start('stopwatch')}
                >
                  <Clock size={15} />
                  Start stopwatch
                  <kbd className="ml-auto text-xs text-muted">
                    {displayKey(keybindings.toggleStopwatch)}
                  </kbd>
                </button>
                <button
                  className={menuItem}
                  onClick={() => openMode('countdown')}
                >
                  <Timer size={15} />
                  Countdown
                  <kbd className="ml-auto text-xs text-muted">
                    {paletteKey} T 2
                  </kbd>
                </button>
                <button className={menuItem} onClick={() => openMode('manual')}>
                  <Pencil size={15} />
                  Log time
                  <kbd className="ml-auto text-xs text-muted">
                    {paletteKey} T 3
                  </kbd>
                </button>
              </>
            )}
          </PopoverPanel>
        </Popover>
      </div>
      {open && (
        <section
          className="TimerRow OverlaySurface text-xs text-text-2"
          aria-label={`Timer for line ${lineInfo.lineIdx + 1}`}
        >
          <fieldset
            disabled={busy}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 min-w-0"
          >
            {runningHere ? (
              <>
                <span>
                  {timer.mode === 'countdown' ? 'Countdown' : 'Stopwatch'}
                  {paused && ' · Paused'}
                </span>
                {timer.mode === 'countdown' && (
                  <Button plain onClick={() => void extendTimer(store)}>
                    +5m
                  </Button>
                )}
                <span className="text-muted">{renderTime(time)} logged</span>
                <button
                  onClick={() => void cancelTimer(store)}
                  className="text-muted hover:text-text"
                >
                  Discard
                </button>
              </>
            ) : (
              <>
                <div
                  className="flex gap-1 rounded-md bg-page/60 p-1"
                  aria-label="Timer mode"
                >
                  {(['stopwatch', 'countdown', 'manual'] as const).map(
                    (item) => (
                      <button
                        key={item}
                        onClick={() => setMode(item)}
                        aria-pressed={mode === item}
                        className={cn(
                          'rounded px-2 py-1',
                          mode === item
                            ? 'bg-white/7 text-text'
                            : 'text-muted hover:text-text'
                        )}
                      >
                        {item === 'manual'
                          ? 'Log time'
                          : item === 'countdown'
                            ? 'Countdown'
                            : 'Stopwatch'}
                      </button>
                    )
                  )}
                </div>
                {mode === 'stopwatch' && (
                  <Button plain onClick={() => start('stopwatch')}>
                    <Play size={13} />
                    Start
                  </Button>
                )}
                {mode === 'countdown' && (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const duration = parseTime(countdown || '25m')
                      if (duration && duration > 0) start('countdown', duration)
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Countdown length"
                      className={inputClass}
                      placeholder="25m"
                      value={countdown}
                      onChange={(e) => setCountdown(e.target.value)}
                    />
                    <Button
                      plain
                      type="submit"
                      disabled={!parseTime(countdown || '25m')}
                    >
                      <Play size={13} />
                      Start
                    </Button>
                    {[15, 25, 50].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className="px-1 py-1 text-muted hover:text-text"
                        onClick={() => start('countdown', minutes * 60)}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </form>
                )}
                {mode === 'manual' && (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      log(false)
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Time to log"
                      className={inputClass}
                      placeholder="45m"
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                    />
                    <Button
                      plain
                      type="submit"
                      disabled={parseTime(manual) === null}
                    >
                      Add
                    </Button>
                    <Button
                      plain
                      type="button"
                      disabled={parseTime(manual) === null}
                      onClick={() => log(true)}
                    >
                      Set total
                    </Button>
                    <span className="text-muted">
                      {renderTime(time)} logged
                    </span>
                  </form>
                )}
              </>
            )}
            <button
              aria-label="Close timer row"
              className="ml-auto p-1 text-muted hover:text-text"
              onClick={() => setOpen(false)}
            >
              <X size={14} />
            </button>
          </fieldset>
        </section>
      )}
    </>
  )
}
