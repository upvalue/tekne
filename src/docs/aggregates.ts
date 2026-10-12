import { extractDocData, treeifyDoc } from './doc-analysis'
import type { ZDoc } from './schema'

export type TagContribution = {
  tag: string
  complete_tasks: number
  incomplete_tasks: number
  unset_tasks: number
  total_time_seconds: number
  pinned_at: Date | null
  pinned_desc: string | null
  pin_line_id: string | null
}

export const emptyContribution = (tag: string): TagContribution => ({
  tag,
  complete_tasks: 0,
  incomplete_tasks: 0,
  unset_tasks: 0,
  total_time_seconds: 0,
  pinned_at: null,
  pinned_desc: null,
  pin_line_id: null,
})

export const newerPin = (
  a: Pick<TagContribution, 'pinned_at' | 'pin_line_id'>,
  b: Pick<TagContribution, 'pinned_at' | 'pin_line_id'>
): boolean => {
  if (!a.pinned_at) return false
  if (!b.pinned_at) return true
  const difference = a.pinned_at.getTime() - b.pinned_at.getTime()
  return (
    difference > 0 ||
    (difference === 0 && (a.pin_line_id ?? '') > (b.pin_line_id ?? ''))
  )
}

export const documentContributions = (
  doc: ZDoc
): Map<string, TagContribution> => {
  const result = new Map<string, TagContribution>()
  for (const datum of extractDocData(treeifyDoc(doc).children)) {
    const row = result.get(datum.datumTag) ?? emptyContribution(datum.datumTag)
    result.set(row.tag, row)
    if (datum.datumType === 'task') {
      if (datum.datumStatus === 'complete') row.complete_tasks++
      else if (datum.datumStatus === 'incomplete') row.incomplete_tasks++
      else row.unset_tasks++
    }
    if (datum.datumType === 'timer')
      row.total_time_seconds += datum.datumTimeSeconds ?? 0
    if (datum.datumType === 'pin' && datum.datumPinnedAt) {
      const pin = {
        pinned_at: new Date(datum.datumPinnedAt),
        pin_line_id: datum.lineId,
      }
      if (newerPin(pin, row))
        Object.assign(row, pin, {
          pinned_desc: datum.datumPinnedContent ?? null,
        })
    }
  }
  return result
}

export type AggregateBaseline = Omit<TagContribution, 'pin_line_id'> & {
  page_complete_tasks?: number
  page_incomplete_tasks?: number
  page_unset_tasks?: number
  page_time_seconds?: number
  other_pinned_at: Date | null
  other_pinned_desc: string | null
  other_pin_line_id: string | null
}

export type LiveAggregate = {
  tag: string
  complete_tasks?: number
  incomplete_tasks?: number
  unset_tasks?: number
  total_time_seconds?: number
  pinned_at: Date | null
  pinned_desc: string | null
  page_complete_tasks: number
  page_incomplete_tasks: number
  page_unset_tasks: number
  page_time_seconds: number
}

export const reconcileAggregates = (
  title: string,
  local: Map<string, TagContribution>,
  baseline: AggregateBaseline[]
): LiveAggregate[] => {
  const server = new Map(baseline.map((row) => [row.tag, row]))
  const isTemplate = title.startsWith('$')
  return [...local.values()]
    .map((page): LiveAggregate => {
      const saved = server.get(page.tag)
      const otherPin = {
        pinned_at: saved?.other_pinned_at ?? null,
        pinned_desc: saved?.other_pinned_desc ?? null,
        pin_line_id: saved?.other_pin_line_id ?? null,
      }
      const pin = !isTemplate && newerPin(page, otherPin) ? page : otherPin
      return {
        tag: page.tag,
        complete_tasks:
          saved &&
          saved.complete_tasks +
            (isTemplate
              ? 0
              : page.complete_tasks - (saved.page_complete_tasks ?? 0)),
        incomplete_tasks:
          saved &&
          saved.incomplete_tasks +
            (isTemplate
              ? 0
              : page.incomplete_tasks - (saved.page_incomplete_tasks ?? 0)),
        unset_tasks:
          saved &&
          saved.unset_tasks +
            (isTemplate ? 0 : page.unset_tasks - (saved.page_unset_tasks ?? 0)),
        total_time_seconds:
          saved &&
          saved.total_time_seconds +
            (isTemplate
              ? 0
              : page.total_time_seconds - (saved.page_time_seconds ?? 0)),
        page_complete_tasks: page.complete_tasks,
        page_incomplete_tasks: page.incomplete_tasks,
        page_unset_tasks: page.unset_tasks,
        page_time_seconds: page.total_time_seconds,
        pinned_at: pin.pinned_at,
        pinned_desc: pin.pinned_desc,
      }
    })
    .filter(
      (row) =>
        row.pinned_at !== null ||
        [
          row.complete_tasks,
          row.incomplete_tasks,
          row.unset_tasks,
          row.total_time_seconds,
          row.page_complete_tasks,
          row.page_incomplete_tasks,
          row.page_unset_tasks,
          row.page_time_seconds,
        ].some((value) => (value ?? 0) > 0)
    )
    .sort((a, b) => a.tag.localeCompare(b.tag))
}
