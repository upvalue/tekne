import type { useStore } from 'jotai'
import type { ZLine } from '@/docs/schema'
import { elapsedMilliseconds, type Timer } from '@/docs/timer'
import { orpcClient } from '@/api/client'
import { toast } from 'sonner'
import { appPath } from '@/lib/app-path'
import { showTimerStartedNotification } from './timer-notifications'
import {
  DEFAULT_COUNTDOWN_SECONDS,
  globalTimerAtom,
  timerBusyAtom,
  type GlobalTimerState,
  type TimerMode,
} from '../state'

type EditorStore = ReturnType<typeof useStore>
type Binding = {
  title: string
  flush: () => Promise<void>
  refresh: () => Promise<void>
  timer: Timer | null
  busy: boolean
  ready: boolean
}
const bindings = new WeakMap<EditorStore, Binding>()

export const IDLE_TIMER_STATE: GlobalTimerState = {
  isActive: false,
  lineId: null,
  lineContent: null,
  mode: 'stopwatch',
  timeMode: 'replacement',
  accumulatedMs: 0,
  runningSince: null,
  targetDuration: DEFAULT_COUNTDOWN_SECONDS,
}
export const timerElapsedSeconds = (timer: {
  accumulatedMs: number
  runningSince: number | null
}): number => Math.floor(elapsedMilliseconds(timer) / 1000)
export const timerRemainingSeconds = (timer: {
  accumulatedMs: number
  runningSince: number | null
  targetDuration: number
}): number => Math.max(0, timer.targetDuration - timerElapsedSeconds(timer))
export const isTimerPaused = (timer: {
  isActive: boolean
  runningSince: number | null
}): boolean => timer.isActive && timer.runningSince === null

export const bindTimer = (
  store: EditorStore,
  options: Pick<Binding, 'title' | 'flush' | 'refresh'>
) => {
  const binding: Binding = {
    ...options,
    timer: null,
    busy: false,
    ready: false,
  }
  bindings.set(store, binding)
  return () => {
    if (bindings.get(store) === binding) releaseTimer(store)
  }
}

export const hydrateTimer = (
  store: EditorStore,
  timer: Timer | null,
  serverNow = Date.now()
) => {
  const binding = bindings.get(store)
  if (!binding || binding.busy) return
  if (binding.ready && binding.timer === timer) return
  binding.ready = true
  binding.timer = timer
  store.set(
    globalTimerAtom,
    timer
      ? {
          isActive: true,
          lineId: timer.lineId,
          lineContent: timer.lineContent,
          noteTitle: timer.noteTitle,
          mode: timer.mode,
          timeMode: timer.timeMode,
          accumulatedMs: timer.accumulatedMs,
          runningSince:
            timer.runningSince === null
              ? null
              : Date.now() - (serverNow - timer.runningSince),
          targetDuration: timer.targetDuration,
        }
      : { ...IDLE_TIMER_STATE, timeMode: store.get(globalTimerAtom).timeMode }
  )
}

const run = async (
  store: EditorStore,
  operation: (binding: Binding) => Promise<void>
): Promise<boolean> => {
  const binding = bindings.get(store)
  if (!binding?.ready) {
    toast.info('Open a saved document and wait for timers to load.')
    return false
  }
  if (binding.busy) return false
  binding.busy = true
  store.set(timerBusyAtom, true)
  try {
    await operation(binding)
    return true
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Timer could not be updated'
    )
    return false
  } finally {
    binding.busy = false
    if (bindings.get(store) === binding) store.set(timerBusyAtom, false)
    await binding.refresh().catch(() => {})
  }
}

export const startTimer = (
  store: EditorStore,
  args: {
    line: ZLine
    mode: Exclude<TimerMode, 'manual'>
    timeMode: GlobalTimerState['timeMode']
    targetDuration: number
  }
) =>
  run(store, async (binding) => {
    if (binding.timer) {
      const current = binding.timer
      toast.info(
        `Timer already running: ${current.lineContent || current.noteTitle}`,
        {
          action: {
            label: 'Jump to line',
            onClick: () => {
              window.location.href = appPath(
                `/n/${encodeURIComponent(current.noteTitle)}#line-${current.lineId}`
              )
            },
          },
        }
      )
      return
    }
    await binding.flush()
    const timer = await orpcClient.timers.start({
      id: crypto.randomUUID(),
      noteTitle: binding.title,
      lineId: args.line.id,
      mode: args.mode,
      timeMode: args.timeMode,
      targetDuration: args.targetDuration,
    })
    showTimerStartedNotification(timer.lineContent, Date.now())
  })
const change = (
  store: EditorStore,
  action: 'pause' | 'resume' | 'save' | 'discard' | 'extend',
  timeMode?: GlobalTimerState['timeMode'],
  expectedTimeSeconds?: number | null
) =>
  run(store, async (binding) => {
    const timer = binding.timer
    if (!timer) return
    if (action === 'save') await binding.flush()
    const result = await orpcClient.timers.change({
      id: timer.id,
      revision: timer.revision,
      action,
      ...(timeMode ? { timeMode, expectedTimeSeconds } : {}),
    })
    if (result?.completionError)
      toast.warning(
        'Elapsed time retained. Resolve this timer in Tools → Timers.'
      )
  })
export const pauseTimer = (store: EditorStore) => change(store, 'pause')
export const resumeTimer = (store: EditorStore) => change(store, 'resume')
export const stopAndSaveTimer = (
  store: EditorStore,
  timeMode?: GlobalTimerState['timeMode'],
  expectedTimeSeconds?: number | null
) => change(store, 'save', timeMode, expectedTimeSeconds)
export const extendTimer = (store: EditorStore) => change(store, 'extend')
export const cancelTimer = (store: EditorStore) => change(store, 'discard')

/** Detach this view without changing the persisted timer. */
export const releaseTimer = (store: EditorStore) => {
  bindings.delete(store)
  store.set(timerBusyAtom, false)
  store.set(globalTimerAtom, IDLE_TIMER_STATE)
}
