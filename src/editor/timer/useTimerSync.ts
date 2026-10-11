import { useEffect, useCallback } from 'react'
import type { useStore } from 'jotai'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/api/client'
import { bindTimer, hydrateTimer } from './timer-controller'

export const useTimerSync = (
  title: string,
  store: ReturnType<typeof useStore>,
  flush: () => Promise<void>
) => {
  const utils = useQueryClient()
  const query = useQuery(
    orpc.timers.list.queryOptions({ refetchInterval: 2000 })
  )
  const refresh = useCallback(async () => {
    await utils.cancelQueries({ queryKey: orpc.timers.list.key() })
    await Promise.all([
      utils.invalidateQueries({ queryKey: orpc.timers.list.key() }),
      utils.invalidateQueries({ queryKey: orpc.doc.loadDoc.key() }),
      utils.invalidateQueries({ queryKey: orpc.analysis.aggregateData.key() }),
    ])
  }, [utils])
  useEffect(
    () => bindTimer(store, { title, flush, refresh }),
    [store, title, flush, refresh]
  )
  useEffect(() => {
    if (query.data)
      hydrateTimer(
        store,
        query.data.timers.find((timer) => timer.completedAt === null) ?? null,
        query.data.serverNow + Date.now() - query.dataUpdatedAt
      )
  }, [query.data, query.dataUpdatedAt, store, title, flush, refresh])
}
