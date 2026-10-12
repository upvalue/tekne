import { useEffect, useRef, useState } from 'react'
import { useAtom, useAtomValue, useStore } from 'jotai'
import {
  Clock,
  MoreHorizontal,
  Pause,
  Play,
  Square,
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
import { notifications } from '@/lib/notifications'
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

/** Running time keeps its seconds so it visibly ticks: 5s, 6m 38s, 1h 2m 5s. */
const formatLiveTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (hours > 0 || minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds % 60}s`)
  return parts.join(' ')
}

const button =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-white/6 px-2.5 py-1.5 text-text-2 hover:bg-white/10 hover:text-text'
const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-mark px-2.5 py-1.5 font-semibold text-text hover:brightness-125'

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
  const timerAnchorRef = useRef<HTMLSpanElement>(null)
  const countdownRef = useRef<HTMLInputElement>(null)
  const manualRef = useRef<HTMLInputElement>(null)
  const runningHere = timer.isActive && timer.lineId === lineInfo.line.id
  const showChip =
    runningHere || time > 0 || lineInfo.line.datumTimeSeconds !== undefined
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
  const isCountdown = timer.mode === 'countdown'
  const additive = timer.timeMode === 'additive'
  const start = (mode: 'stopwatch' | 'countdown', duration = 25 * 60) => {
    if (supportsTimerNotifications() && Notification.permission === 'default') {
      void enableTimerNotifications().catch(() => {})
    }
    setMenuOpen(false)
    setOpen(false)
    void startTimer(store, {
      line: lineInfo.line,
      mode,
      timeMode: store.get(globalTimerAtom).timeMode,
      targetDuration: duration,
    })
  }
  const stop = () => {
    setOpen(false)
    void stopAndSaveTimer(store)
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
    setOpen(false)
    notifications.success(
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
    'w-24 min-w-0 rounded-md border border-transparent bg-page px-2 py-1.5 tabular-nums text-text outline-none focus:border-accent'
  const openMode = (next: typeof mode) => {
    store.set(focusedLineAtom, lineInfo.lineIdx)
    setMode(next)
    setOpen(true)
    setMenuOpen(false)
  }
  const paletteKey = displayKey(keybindings.commandPalette)
  const menuItem =
    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text-2 hover:bg-white/5 focus:bg-white/5 outline-none'
  const liveTime = isCountdown
    ? `${formatTimeDisplay(remaining)} left`
    : formatLiveTime(elapsed)
  const lineLabel = `line ${lineInfo.lineIdx + 1}`
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        {showChip ? (
          <div className="ELine-leading TimerChip ml-2 text-xs tabular-nums whitespace-nowrap">
            <PopoverButton
              className={cn(
                'flex items-center gap-1.5 rounded px-1.5 leading-5',
                runningHere && !paused
                  ? 'bg-accent-tint text-accent hover:brightness-125 data-popup-open:brightness-125'
                  : 'bg-white/7 text-text-2 hover:bg-white/11 hover:text-text data-popup-open:bg-white/11'
              )}
              aria-label={`Time for ${lineLabel}`}
              onClick={() => {
                store.set(focusedLineAtom, lineInfo.lineIdx)
                setMode(runningHere ? timer.mode : 'stopwatch')
              }}
            >
              {!runningHere ? (
                <Clock size={11} />
              ) : paused ? (
                <Pause size={11} />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
              {runningHere ? (
                <span>
                  {additive && time > 0 && (
                    <span className="text-muted">{renderTime(time)} + </span>
                  )}
                  <span className={cn(paused && 'text-text-2')}>
                    {liveTime}
                  </span>
                </span>
              ) : (
                time > 0 && renderTime(time)
              )}
            </PopoverButton>
          </div>
        ) : (
          <span
            ref={timerAnchorRef}
            aria-hidden="true"
            className="pointer-events-none col-start-5 row-start-1 h-6 w-0"
          />
        )}
        <PopoverPanel
          anchor={showChip ? undefined : timerAnchorRef}
          align="start"
          sideOffset={6}
          aria-label={`Timer for ${lineLabel}`}
          initialFocus={() =>
            (mode === 'countdown'
              ? countdownRef.current
              : mode === 'manual'
                ? manualRef.current
                : null) ?? true
          }
          className="OverlaySurface TimerPopover w-[300px] max-w-[calc(100vw-24px)] p-3.5 text-[13px] text-text-2"
        >
          <fieldset disabled={busy} className="grid gap-3 min-w-0">
            <div
              className="flex gap-1 rounded-md bg-page/60 p-1"
              aria-label="Timer type"
            >
              {(['stopwatch', 'countdown', 'manual'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  aria-pressed={mode === item}
                  className={cn(
                    'flex-1 rounded px-2 py-1',
                    mode === item
                      ? 'bg-white/7 text-text'
                      : 'text-muted hover:text-text'
                  )}
                >
                  {item === 'stopwatch'
                    ? 'Stopwatch'
                    : item === 'countdown'
                      ? 'Countdown'
                      : 'Manual'}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {additive ? 'Add to existing time' : 'Replace existing time'}
                {time > 0 && ` (${renderTime(time)})`}
              </span>
              <div
                className="flex gap-1 rounded-md bg-page/60 p-1"
                aria-label="Time entry mode"
                title={
                  timer.isActive ? 'Fixed while a timer is running' : undefined
                }
              >
                {(['additive', 'replacement'] as const).map((item) => (
                  <button
                    key={item}
                    disabled={timer.isActive}
                    aria-pressed={timer.timeMode === item}
                    onClick={() =>
                      store.set(globalTimerAtom, (prev) => ({
                        ...prev,
                        timeMode: item,
                      }))
                    }
                    className={cn(
                      'rounded px-2 py-0.5 text-xs disabled:cursor-default',
                      timer.timeMode === item
                        ? 'bg-white/7 text-text'
                        : 'text-muted enabled:hover:text-text'
                    )}
                  >
                    {item === 'additive' ? 'Add' : 'Replace'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-white/7" />
            {runningHere && mode === timer.mode ? (
              <>
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-baseline gap-2 text-[28px] leading-tight font-medium tabular-nums text-text">
                    {additive && time > 0 && (
                      <span className="text-[15px] font-normal text-muted">
                        {renderTime(time)} +
                      </span>
                    )}
                    {formatTimeDisplay(isCountdown ? remaining : elapsed)}
                    {paused && (
                      <span className="rounded bg-white/7 px-1.5 text-[11px] font-normal text-text-2">
                        Paused
                      </span>
                    )}
                  </div>
                  {isCountdown && (
                    <div className="text-xs text-muted">
                      {!paused &&
                        `Ends at ${new Date(
                          Date.now() + remaining * 1000
                        ).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })} · `}
                      {formatLiveTime(elapsed)} of{' '}
                      {renderTime(timer.targetDuration)}
                    </div>
                  )}
                </div>
                {isCountdown && (
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full bg-accent"
                      style={{
                        width: `${Math.min(100, (elapsed / timer.targetDuration) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button
                    className={cn(button, 'flex-1')}
                    title={`${paused ? 'Resume' : 'Pause'} (${displayKey(keybindings.toggleStopwatch)})`}
                    onClick={() =>
                      void (paused ? resumeTimer(store) : pauseTimer(store))
                    }
                  >
                    {paused ? <Play size={12} /> : <Pause size={12} />}
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                  {isCountdown && (
                    <button
                      className={button}
                      onClick={() => void extendTimer(store)}
                    >
                      +5m
                    </button>
                  )}
                </div>
                <button className={primaryButton} onClick={stop}>
                  <Square size={11} />
                  {!additive
                    ? `Stop and set to ${renderTime(elapsed)}`
                    : time > 0
                      ? `Stop and add · ${renderTime(time + elapsed)} total`
                      : `Stop and log ${renderTime(elapsed)}`}
                </button>
                <button
                  className="justify-self-start px-1 text-muted hover:text-text"
                  onClick={() => {
                    setOpen(false)
                    void cancelTimer(store)
                  }}
                >
                  Discard this session
                </button>
              </>
            ) : mode === 'manual' ? (
              <form
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  log(!additive)
                }}
              >
                <input
                  ref={manualRef}
                  aria-label="Time to log"
                  className={cn(inputClass, 'flex-1')}
                  placeholder="45m, 1h 20m"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
                <button
                  type="submit"
                  className={button}
                  disabled={parseTime(manual) === null}
                >
                  {additive ? 'Add time' : 'Set time'}
                </button>
              </form>
            ) : timer.isActive ? (
              <div className="text-xs text-muted">
                {runningHere
                  ? `A ${timer.mode} is running on this line.`
                  : 'Another timer is running. Stop it before starting a new one.'}
              </div>
            ) : mode === 'stopwatch' ? (
              <button
                className={primaryButton}
                onClick={() => start('stopwatch')}
              >
                <Play size={12} />
                Start stopwatch
              </button>
            ) : (
              <form
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  const duration = parseTime(countdown)
                  if (duration && duration > 0) start('countdown', duration)
                }}
              >
                {[15, 25, 50].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={button}
                    onClick={() => start('countdown', minutes * 60)}
                  >
                    {minutes}m
                  </button>
                ))}
                <input
                  ref={countdownRef}
                  aria-label="Countdown length"
                  className={inputClass}
                  placeholder="Custom"
                  value={countdown}
                  onChange={(e) => setCountdown(e.target.value)}
                />
              </form>
            )}
          </fieldset>
        </PopoverPanel>
      </Popover>
      <div className={cn('LineActions', menuOpen && 'LineActions-open')}>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverButton
            aria-label={`Actions for ${lineLabel}`}
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
            aria-label={`Actions for ${lineLabel}`}
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
              <button
                className={menuItem}
                onClick={() => openMode('stopwatch')}
              >
                <Clock size={15} />
                Timer controls…
                <kbd className="ml-auto text-xs text-muted">
                  {displayKey(keybindings.openTimerRow)}
                </kbd>
              </button>
            ) : (
              <>
                <button
                  disabled={busy}
                  className={menuItem}
                  onClick={() => start('stopwatch')}
                >
                  <Play size={15} />
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
                  Countdown…
                  <kbd className="ml-auto text-xs text-muted">
                    {paletteKey} T 2
                  </kbd>
                </button>
                <button className={menuItem} onClick={() => openMode('manual')}>
                  <Pencil size={15} />
                  Manual…
                  <kbd className="ml-auto text-xs text-muted">
                    {paletteKey} T 3
                  </kbd>
                </button>
              </>
            )}
          </PopoverPanel>
        </Popover>
      </div>
    </>
  )
}
