import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { orpc, orpcClient } from '@/api/client'
import { elapsedMilliseconds } from '@/docs/timer'
import { setDetailTitle, setTimerActive, setTimerDisplay } from '@/lib/title'
import { formatTimeDisplay } from '@/lib/time'
import { playTimerCompleteSound } from '@/lib/sound'
import { dismissTimerNotification } from './timer-notifications'
import { notifications } from '@/lib/notifications'

/** Runs outside document routes so navigation cannot interrupt a timer. */
export const TimerObserver = () => {
  const query = useQuery(
    orpc.timers.list.queryOptions({
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    })
  )
  const utils = useQueryClient()
  const notified = useRef(new Set<string>())
  const attempts = useRef(new Map<string, number>())
  useEffect(() => {
    const active = query.data?.timers.find(
      (timer) => timer.completedAt === null
    )
    setTimerActive(!!active)
    setDetailTitle(active?.lineContent ?? null)
    if (!active || active.runningSince === null) void dismissTimerNotification()
    for (const timer of query.data?.timers ?? []) {
      if (timer.completionError && !notified.current.has(`error:${timer.id}`)) {
        notified.current.add(`error:${timer.id}`)
        notifications.warning(
          'A completed timer needs attention in Tools → Timers.'
        )
      }
    }
  }, [query.data])
  useEffect(() => {
    if (!query.data) return
    const data = query.data
    const check = () => {
      const serverNow = data.serverNow + Date.now() - query.dataUpdatedAt
      const active = data.timers.find((timer) => timer.completedAt === null)
      if (active) {
        const elapsed = Math.floor(
          elapsedMilliseconds(active, serverNow) / 1000
        )
        const seconds =
          active.mode === 'countdown'
            ? Math.max(0, active.targetDuration - elapsed)
            : (active.baseTimeSeconds ?? 0) + elapsed
        setTimerDisplay(
          `${active.runningSince === null ? 'Ⅱ' : '●'} ${formatTimeDisplay(seconds)} · ${active.lineContent || active.noteTitle}`
        )
      } else setTimerDisplay(null)
      for (const timer of data.timers) {
        if (
          timer.mode !== 'countdown' ||
          timer.runningSince === null ||
          elapsedMilliseconds(timer, serverNow) < timer.targetDuration * 1000
        )
          continue
        if (!notified.current.has(timer.id)) {
          notified.current.add(timer.id)
          playTimerCompleteSound()
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification('Timer Complete', {
                body: timer.lineContent,
                icon: '/favicon/tekne32.png',
              })
            } catch {
              /* Mobile browsers may only support worker notifications. */
            }
          }
        }
        if (Date.now() - (attempts.current.get(timer.id) ?? 0) < 5000) continue
        attempts.current.set(timer.id, Date.now())
        // Also completes timers in the browser-backed demo. The server checks
        // the deadline, so a fast client clock cannot complete a timer early.
        void orpcClient.timers
          .change({
            id: timer.id,
            revision: timer.revision,
            action: 'complete',
          })
          .then(async () => {
            await utils.cancelQueries({ queryKey: orpc.timers.list.key() })
            await Promise.all([
              utils.invalidateQueries({ queryKey: orpc.timers.list.key() }),
              utils.invalidateQueries({ queryKey: orpc.doc.loadDoc.key() }),
              utils.invalidateQueries({
                queryKey: orpc.analysis.key(),
              }),
            ])
          })
          .catch(() => {
            void utils.invalidateQueries({ queryKey: orpc.timers.list.key() })
          })
      }
    }
    check()
    const interval = setInterval(check, 1000)
    return () => clearInterval(interval)
  }, [query.data, query.dataUpdatedAt, utils])
  return null
}
