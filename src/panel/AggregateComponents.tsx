import { renderTime } from '@/lib/time'
import { Pin } from 'lucide-react'

export interface ResultCardData {
  tag: string
  complete_tasks?: number
  incomplete_tasks?: number
  unset_tasks?: number
  total_time_seconds?: number
  pinned_at?: Date | string | null
  pinned_desc?: string | null
  page_complete_tasks?: number
  page_incomplete_tasks?: number
  page_unset_tasks?: number
  page_time_seconds?: number
}

export const AggregateList = ({ data }: { data: ResultCardData[] }) => (
  <ul aria-label="Tag aggregates">
    {data.map((tag) => {
      const totals = [
        tag.total_time_seconds ? renderTime(tag.total_time_seconds) : null,
        tag.complete_tasks ? `${tag.complete_tasks} done` : null,
        tag.unset_tasks ? `${tag.unset_tasks} open` : null,
        tag.incomplete_tasks ? `${tag.incomplete_tasks} cancelled` : null,
      ].filter(Boolean)
      return (
        <li key={tag.tag} className="min-w-0 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <span className="text-sm text-accent [overflow-wrap:anywhere] min-w-0">
              {tag.tag.startsWith('#') ? tag.tag : `#${tag.tag}`}
            </span>
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-text-2 min-w-0">
              {!!tag.page_time_seconds && (
                <span className="font-mono">
                  +{renderTime(tag.page_time_seconds)}
                </span>
              )}
              {!!tag.page_complete_tasks && (
                <span className="text-done">
                  +{tag.page_complete_tasks} done
                </span>
              )}
              {!!tag.page_unset_tasks && (
                <span>{tag.page_unset_tasks} open</span>
              )}
              {!!tag.page_incomplete_tasks && (
                <span>{tag.page_incomplete_tasks} cancelled</span>
              )}
            </div>
          </div>
          {totals.length > 0 && (
            <div
              className="text-xs text-muted mt-1 flex flex-wrap gap-x-1"
              aria-label="All-time totals"
            >
              {totals.map((total, index) => (
                <span key={total}>
                  {index > 0 && '· '}
                  {total}
                </span>
              ))}
            </div>
          )}
          {tag.pinned_at && tag.pinned_desc && (
            <p className="mt-1.5 text-xs text-text-2 [overflow-wrap:anywhere]">
              <Pin size={11} className="inline mr-1 text-muted" />
              {tag.pinned_desc}
            </p>
          )}
        </li>
      )
    })}
  </ul>
)

export const ResultCardGrid = ({ data }: { data: ResultCardData[] }) => (
  <AggregateList data={data} />
)
