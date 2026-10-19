import { useEffect, useMemo, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/api/client'
import { documentContributions, reconcileAggregates } from '@/docs/aggregates'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { docAtom, focusedLineAtom, focusedPosAtom } from '@/editor/state'
import { TEKNE_MD_PARSER, visitMdTree } from '@/docs/parser'
import { syncedDocumentAtom } from '@/editor/document-sync-state'

export const useLiveAggregates = (title: string | null | undefined) => {
  const doc = useAtomValue(docAtom)
  const synced = useAtomValue(syncedDocumentAtom)
  const ready = !!title && synced?.title === title
  const local = useMemo(() => documentContributions(doc), [doc])
  const focusedLine = useAtomValue(focusedLineAtom)
  const focusedPos = useAtomValue(focusedPosAtom)
  const admitted = useRef({ title, tags: new Set(local.keys()) })
  if (admitted.current.title !== title)
    admitted.current = { title, tags: new Set(local.keys()) }
  const content =
    focusedLine === null ? '' : (doc.children[focusedLine]?.mdContent ?? '')
  let editingTag: string | undefined
  visitMdTree(TEKNE_MD_PARSER.parse(content).topNode, content, 0, (node) => {
    if (
      node.type.name === 'Tag' &&
      node.from < focusedPos &&
      focusedPos <= node.to
    )
      editingTag = content.slice(node.from, node.to)
  })
  const visible = new Map(local)
  if (editingTag && !admitted.current.tags.has(editingTag))
    visible.delete(editingTag)
  useEffect(() => {
    for (const tag of local.keys())
      if (tag !== editingTag) admitted.current.tags.add(tag)
  }, [local, editingTag])
  const tagKey = JSON.stringify([...visible.keys()].sort())
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
    ? reconcileAggregates(title, visible, query.data?.rows ?? []).filter(
        (row) => row.complete_tasks !== undefined
      )
    : []
  return { ...query, data, ready }
}
