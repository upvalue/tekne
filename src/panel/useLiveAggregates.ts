import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/api/client'
import { documentContributions, reconcileAggregates } from '@/docs/aggregates'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { docAtom } from '@/editor/state'
import { syncedDocumentAtom } from '@/editor/document-sync-state'

export const useLiveAggregates = (title: string | null | undefined) => {
  const doc = useAtomValue(docAtom)
  const synced = useAtomValue(syncedDocumentAtom)
  const ready = !!title && synced?.title === title
  const local = useMemo(() => documentContributions(doc), [doc])
  const tagKey = JSON.stringify([...local.keys()].sort())
  const debouncedTags = useDebouncedValue(tagKey, 200)
  const tags: string[] = JSON.parse(debouncedTags)
  const query = useQuery(
    orpc.analysis.aggregateSnapshot.queryOptions({
      input: { title: title ?? '', tags },
      enabled: ready && tags.length > 0,
      // Keep known totals while fetching a newly typed tag. Missing tags stay pending.
      placeholderData: (previous) =>
        previous?.title === title ? previous : undefined,
      refetchInterval: 5000,
    })
  )
  const data = ready
    ? reconcileAggregates(title, local, query.data?.rows ?? [])
    : []
  return { ...query, data, ready }
}
