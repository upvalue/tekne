// Shared aggregate display components for use in Aggregate panel and Search

import { renderTime } from '@/lib/time'
import {
  CheckCircleIcon,
  XCircleIcon,
  EllipsisHorizontalIcon,
  ClockIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

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
    (unset && unset > 0) ||
    (complete && complete > 0) ||
    (incomplete && incomplete > 0)

  if (!hasTasks) {
    return null
  }

  return (
    <div className={`flex space-x-4 items-center ${className || ''}`}>
      {complete && complete > 0 ? (
        <TaskStatusItem
          icon={CheckCircleIcon}
          count={complete}
          className="text-green-400"
        />
      ) : null}
      {incomplete && incomplete > 0 ? (
        <TaskStatusItem
          icon={XCircleIcon}
          count={incomplete}
          className="text-zinc-400"
        />
      ) : null}
      {unset && unset > 0 ? (
        <TaskStatusItem
          icon={EllipsisHorizontalIcon}
          count={unset || 0}
          className="text-zinc-400"
        />
      ) : null}
    </div>
  )
}

export const TimerDisplay = ({ time }: { time: number }) => {
  return (
    <div className="flex items-center text-zinc-200 space-x-1">
      <ClockIcon className="size-4" />
      <span className="text-lg font-medium">{renderTime(time)}</span>
    </div>
  )
}

const PageContribution = ({
  pageComplete,
  pageIncomplete,
  pageUnset,
  pageTime,
}: {
  pageComplete?: number
  pageIncomplete?: number
  pageUnset?: number
  pageTime?: number
}) => {
  const hasTaskContribution =
    (pageComplete && pageComplete > 0) ||
    (pageIncomplete && pageIncomplete > 0) ||
    (pageUnset && pageUnset > 0)
  const hasTimerContribution = pageTime !== undefined && pageTime > 0
  if (!hasTaskContribution && !hasTimerContribution) return null

  return (
    <div className="flex items-center space-x-1.5 text-sm text-zinc-500">
      <PlusIcon className="size-3.5" />
      {pageComplete && pageComplete > 0 ? (
        <div className="flex items-center space-x-1 text-green-400">
          <CheckCircleIcon className="size-3.5" />
          <span>{pageComplete}</span>
        </div>
      ) : null}
      {pageIncomplete && pageIncomplete > 0 ? (
        <div className="flex items-center space-x-1 text-red-400">
          <XCircleIcon className="size-3.5" />
          <span>{pageIncomplete}</span>
        </div>
      ) : null}
      {pageUnset && pageUnset > 0 ? (
        <div className="flex items-center space-x-1 text-zinc-400">
          <EllipsisHorizontalIcon className="size-3.5" />
          <span>{pageUnset}</span>
        </div>
      ) : null}
      {hasTimerContribution ? (
        <div className="flex items-center space-x-1 text-zinc-400">
          <ClockIcon className="size-3.5" />
          <span>{renderTime(pageTime!)}</span>
        </div>
      ) : null}
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
        {tagData.pinned_at && (
          <PinnedDisplay pinnedDesc={tagData.pinned_desc!} />
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
    <div className="space-y-6">
      <div className="columns-2 gap-4 space-y-4">
        {data.map((d) => (
          <div key={`card-${d.tag}`} className="break-inside-avoid mb-4">
            <ResultCard tagData={d} />
          </div>
        ))}
      </div>
    </div>
  )
}
