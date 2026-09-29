// The timer engine. Owns the single app-wide interval and every transition
// of globalTimerAtom, so components only render state and call these
// functions. Stopping and cancelling are distinct on purpose: stopAndSave
// writes the elapsed time to the line, cancel discards it (the old combined
// "stop" made the Reset button silently save).
import type { useStore } from 'jotai'
import type { ZLine } from '@/docs/schema'
import { orpcClient } from '@/api/client'
import { setDetailTitle, setTimerActive } from '@/lib/title'
import { playTimerCompleteSound } from '@/lib/sound'
import { isMobile } from '@/lib/platform'
import {
  dismissTimerNotification,
  showTimerStartedNotification,
} from './timer-notifications'
import {
  DEFAULT_COUNTDOWN_SECONDS,
  docAtom,
  findLineByTimeCreated,
  globalTimerAtom,
  setDocLineDirect,
  type GlobalTimerState,
  type TimerMode,
} from '../state'

type EditorStore = ReturnType<typeof useStore>

export const IDLE_TIMER_STATE: GlobalTimerState = {
  isActive: false,
  lineTimeCreated: null,
  lineContent: null,
  mode: 'stopwatch',
  timeMode: 'replacement',
  accumulatedMs: 0,
  runningSince: null,
  targetDuration: DEFAULT_COUNTDOWN_SECONDS,
}

// Only one timer can run at a time (startTimer refuses while one is active),
// so a single module-level interval handle suffices.
let activeInterval: ReturnType<typeof setInterval> | null = null

const clearActiveInterval = () => {
  if (activeInterval !== null) {
    clearInterval(activeInterval)
    activeInterval = null
  }
}

/** Seconds elapsed across all run segments, excluding paused time. */
export const timerElapsedSeconds = (timer: {
  accumulatedMs: number
  runningSince: number | null
}): number =>
  Math.floor(
    (timer.accumulatedMs +
      (timer.runningSince !== null ? Date.now() - timer.runningSince : 0)) /
      1000
  )

/** Seconds remaining on a countdown timer. */
export const timerRemainingSeconds = (timer: {
  accumulatedMs: number
  runningSince: number | null
  targetDuration: number
}): number => Math.max(0, timer.targetDuration - timerElapsedSeconds(timer))

/** True while a timer exists but is not accruing time. */
export const isTimerPaused = (timer: {
  isActive: boolean
  runningSince: number | null
}): boolean => timer.isActive && timer.runningSince === null

const execTimerHook = (
  store: EditorStore,
  hook: 'timer-start' | 'timer-stop'
) => {
  const doc = store.get(docAtom)
  const timer = store.get(globalTimerAtom)
  const found = findLineByTimeCreated(doc, timer.lineTimeCreated)
  if (!found) return
  orpcClient
    .execHook({
      hook,
      argument: {
        doc,
        line: found.line.mdContent,
        lineIdx: found.lineIdx,
      },
    })
    .catch((error) => console.error(`[hook] ${hook} failed`, error))
}

const sendCompletionNotification = (message: string) => {
  if (
    !isMobile &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification('Timer Complete', {
        body: message,
        icon: '/favicon/tekne32-sky.png',
      })
    } catch (error) {
      console.error('Timer notification failed', error)
    }
  }
}

/**
 * Start a stopwatch or countdown timer for a line. Refuses when another
 * line's timer is already running.
 */
export const startTimer = (
  store: EditorStore,
  args: {
    line: ZLine
    mode: Exclude<TimerMode, 'manual'>
    timeMode: GlobalTimerState['timeMode']
    targetDuration: number
  }
): void => {
  const current = store.get(globalTimerAtom)
  if (current.isActive && current.lineTimeCreated !== args.line.timeCreated) {
    return
  }

  clearActiveInterval()
  setDetailTitle(args.line.mdContent)
  setTimerActive(true)

  store.set(globalTimerAtom, {
    isActive: true,
    lineTimeCreated: args.line.timeCreated,
    lineContent: args.line.mdContent,
    mode: args.mode,
    timeMode: args.timeMode,
    accumulatedMs: 0,
    runningSince: Date.now(),
    targetDuration: args.targetDuration,
  })

  execTimerHook(store, 'timer-start')
  showTimerStartedNotification(
    args.line.mdContent,
    store.get(globalTimerAtom).runningSince!
  )

  // The interval exists only to detect countdown completion; elapsed-time
  // display derives from accumulatedMs/runningSince and ticks locally in
  // the components.
  if (args.mode === 'countdown') {
    activeInterval = setInterval(() => {
      const timer = store.get(globalTimerAtom)
      if (!timer.isActive) {
        clearActiveInterval()
        return
      }
      if (timerRemainingSeconds(timer) === 0) {
        sendCompletionNotification(`Timer completed for: ${timer.lineContent}`)
        playTimerCompleteSound()
        stopAndSaveTimer(store)
      }
    }, 1000)
  }
}

/**
 * Pause the running timer: fold the current run segment into accumulatedMs.
 * Elapsed time stays derived, so pausing is drift-free and the countdown
 * completion check simply stops advancing.
 */
export const pauseTimer = (store: EditorStore): void => {
  const timer = store.get(globalTimerAtom)
  if (!timer.isActive || timer.runningSince === null) return
  dismissTimerNotification()
  store.set(globalTimerAtom, {
    ...timer,
    accumulatedMs: timer.accumulatedMs + (Date.now() - timer.runningSince),
    runningSince: null,
  })
}

/** Resume a paused timer by opening a new run segment. */
export const resumeTimer = (store: EditorStore): void => {
  const timer = store.get(globalTimerAtom)
  if (!timer.isActive || timer.runningSince !== null) return
  store.set(globalTimerAtom, { ...timer, runningSince: Date.now() })
}

/** Stop the running timer and write the elapsed time to its line. */
export const stopAndSaveTimer = (store: EditorStore): void => {
  const timer = store.get(globalTimerAtom)
  if (!timer.isActive) return

  execTimerHook(store, 'timer-stop')

  const doc = store.get(docAtom)
  const found = findLineByTimeCreated(doc, timer.lineTimeCreated)
  if (found) {
    const elapsed = timerElapsedSeconds(timer)
    const worked =
      timer.mode === 'countdown'
        ? Math.min(elapsed, timer.targetDuration)
        : elapsed
    setDocLineDirect(store, found.lineIdx, (line) => {
      line.datumTimeSeconds =
        timer.timeMode === 'additive'
          ? (line.datumTimeSeconds || 0) + worked
          : worked
    })
  }

  releaseTimer(store)
}

/** Stop the running timer and discard the elapsed time. */
export const cancelTimer = (store: EditorStore): void => {
  if (!store.get(globalTimerAtom).isActive) return
  releaseTimer(store)
}

/**
 * Clear the interval, title marker, and timer state without touching the
 * document. Also the route-unmount cleanup: a per-route store dies with its
 * route, and the interval must not outlive it.
 */
export const releaseTimer = (store: EditorStore): void => {
  dismissTimerNotification()
  clearActiveInterval()
  setDetailTitle(null)
  setTimerActive(false)
  store.set(globalTimerAtom, IDLE_TIMER_STATE)
}
