// Shared aggregate display components for use in Aggregate panel and Search

import { renderTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { CircleCheck, CircleX, Ellipsis, Clock, Plus } from 'lucide-react'

interface TaskStatusItemProps {
  icon: React.ComponentType<{ className?: string }>
  count: number
  className?: string
}

export const TaskStatusItem = ({
  icon: Icon,
  count,
  className = '',
}: TaskStatusItemProps) => {
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <Icon className={'size-4'} />
      <span className={'text-lg font-medium'}>{count}</span>
    </div>
  )
}

interface TaskStatusDisplayProps {
  complete?: number
  incomplete?: number
  unset?: number
  className?: string
}

export const TaskStatusDisplay = ({
  complete,
  incomplete,
  unset,
  className,
}: TaskStatusDisplayProps) => {
  const hasTasks =
    (unset ?? 0) > 0 || (complete ?? 0) > 0 || (incomplete ?? 0) > 0

  if (!hasTasks) {
    return null
  }

  return (
    <div className={cn('flex space-x-4 items-center', className)}>
      {complete !== undefined && complete > 0 && (
        <TaskStatusItem
          icon={CircleCheck}
          count={complete}
          className="text-green-400"
        />
      )}
      {incomplete !== undefined && incomplete > 0 && (
        <TaskStatusItem
          icon={CircleX}
          count={incomplete}
          className="text-zinc-400"
        />
      )}
      {unset !== undefined && unset > 0 && (
        <TaskStatusItem
          icon={Ellipsis}
          count={unset}
          className="text-zinc-400"
        />
      )}
    </div>
  )
}

export const TimerDisplay = ({
  time,
  className,
}: {
  time: number
  className?: string
}) => {
  return (
    <div className={cn('flex items-center text-zinc-200 space-x-1', className)}>
      <Clock className="size-4" />
      <span className="text-lg font-medium">{renderTime(time)}</span>
    </div>
  )
}

const PageContribution = ({
  pageComplete,
  pageIncomplete,
  pageUnset,
  pageTime,
  className,
}: {
  pageComplete?: number
  pageIncomplete?: number
  pageUnset?: number
  pageTime?: number
  className?: string
}) => {
  const hasTaskContribution =
    (pageComplete ?? 0) > 0 || (pageIncomplete ?? 0) > 0 || (pageUnset ?? 0) > 0
  const hasTimerContribution = pageTime !== undefined && pageTime > 0
  if (!hasTaskContribution && !hasTimerContribution) return null

  return (
    <div
      className={cn(
        'flex items-center space-x-1.5 text-sm text-zinc-500',
        className
      )}
    >
      <Plus className="size-3.5" />
      {pageComplete !== undefined && pageComplete > 0 && (
        <div className="flex items-center space-x-1 text-green-400">
          <CircleCheck className="size-3.5" />
          <span>{pageComplete}</span>
        </div>
      )}
      {pageIncomplete !== undefined && pageIncomplete > 0 && (
        <div className="flex items-center space-x-1 text-red-400">
          <CircleX className="size-3.5" />
          <span>{pageIncomplete}</span>
        </div>
      )}
      {pageUnset !== undefined && pageUnset > 0 && (
        <div className="flex items-center space-x-1 text-zinc-400">
          <Ellipsis className="size-3.5" />
          <span>{pageUnset}</span>
        </div>
      )}
      {pageTime !== undefined && pageTime > 0 && (
        <div className="flex items-center space-x-1 text-zinc-400">
          <Clock className="size-3.5" />
          <span>{renderTime(pageTime)}</span>
        </div>
      )}
    </div>
  )
}

export const PinnedDisplay = ({ pinnedDesc }: { pinnedDesc: string }) => {
  return (
    <div className="flex items-center text-zinc-500 space-x-1 text-sm">
      <span>{pinnedDesc}</span>
    </div>
  )
}

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

/** One inset per row, independent of the viewport or resizable panel width. */
export const AggregateList = ({ data }: { data: ResultCardData[] }) => {
  return (
    <ul aria-label="Tag aggregates">
      {data.map((tagData) => {
        const hasMetrics =
          (tagData.complete_tasks ?? 0) > 0 ||
          (tagData.incomplete_tasks ?? 0) > 0 ||
          (tagData.unset_tasks ?? 0) > 0 ||
          (tagData.total_time_seconds ?? 0) > 0

        return (
          <li
            key={tagData.tag}
            className="min-w-0 space-y-1 px-3 py-2.5 odd:bg-zinc-800/40"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 text-sm font-medium text-zinc-200 [overflow-wrap:anywhere]">
                {tagData.tag}
              </span>
              <PageContribution
                pageComplete={tagData.page_complete_tasks}
                pageIncomplete={tagData.page_incomplete_tasks}
                pageUnset={tagData.page_unset_tasks}
                pageTime={tagData.page_time_seconds}
                className="flex-wrap gap-x-1.5 gap-y-1 space-x-0 [&>div]:shrink-0 [&_svg]:shrink-0"
              />
            </div>
            {hasMetrics && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <TaskStatusDisplay
                  complete={tagData.complete_tasks}
                  incomplete={tagData.incomplete_tasks}
                  unset={tagData.unset_tasks}
                  className="flex-wrap gap-x-3 gap-y-1 space-x-0 [&>div]:shrink-0"
                />
                {tagData.total_time_seconds ? (
                  <TimerDisplay
                    time={tagData.total_time_seconds}
                    className="whitespace-nowrap [&_svg]:shrink-0"
                  />
                ) : null}
              </div>
            )}
            {tagData.pinned_at && tagData.pinned_desc && (
              <p className="text-sm text-zinc-400 [overflow-wrap:anywhere]">
                {tagData.pinned_desc}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export const ResultCard = ({ tagData }: { tagData: ResultCardData }) => {
  return (
    <div className="relative">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-sm p-4 flex flex-col space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{tagData.tag}</span>
          <PageContribution
            pageComplete={tagData.page_complete_tasks}
            pageIncomplete={tagData.page_incomplete_tasks}
            pageUnset={tagData.page_unset_tasks}
            pageTime={tagData.page_time_seconds}
          />
        </div>
        {tagData.pinned_at && tagData.pinned_desc && (
          <PinnedDisplay pinnedDesc={tagData.pinned_desc} />
        )}
        <TaskStatusDisplay
          complete={tagData.complete_tasks}
          incomplete={tagData.incomplete_tasks}
          unset={tagData.unset_tasks}
        />
        {tagData.total_time_seconds ? (
          <TimerDisplay time={tagData.total_time_seconds} />
        ) : null}
      </div>
    </div>
  )
}

export const ResultCardGrid = ({ data }: { data: ResultCardData[] }) => {
  return (
    <div className="columns-1 gap-4 md:columns-2">
      {data.map((d) => (
        <div key={`card-${d.tag}`} className="mb-4 break-inside-avoid">
          <ResultCard tagData={d} />
        </div>
      ))}
    </div>
  )
}
