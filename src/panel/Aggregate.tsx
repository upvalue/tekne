import { useDocTitle } from '@/hooks/useDocTitle'
import { renderTime } from '@/lib/time'
import { trpc } from '@/trpc/client'
import type { AggregateDataOutput } from '@/trpc/types'

import { CheckCircleIcon, XCircleIcon, EllipsisHorizontalIcon, ClockIcon } from '@heroicons/react/24/outline'
import { CircleStackIcon } from '@heroicons/react/24/outline'

interface TaskStatusItemProps {
    icon: React.ComponentType<{ className?: string }>
    count: number
    className?: string
}

const TaskStatusItem = ({
    icon: Icon,
    count,
    className = '',
}: TaskStatusItemProps) => {
    return (
        <div className={`flex items-center space-x-1 ${className}`}>
            <Icon className={"size-4"} />
            <span className={"text-lg font-medium"}>
                {count}
            </span>
        </div>
    );
};

interface TaskStatusDisplayProps {
    complete?: number
    incomplete?: number
    unset?: number
    className?: string
}

const TaskStatusDisplay = ({ complete, incomplete, unset, className }: TaskStatusDisplayProps) => {
    const hasTasks = (unset && unset > 0) || (complete && complete > 0) || (incomplete && incomplete > 0);

    if (!hasTasks) {
        return null;
    }

    return (
        <div className={`flex space-x-4 items-center ${className || ''}`}>
            {(complete && complete > 0) ? (
                <TaskStatusItem
                    icon={CheckCircleIcon}
                    count={complete}
                    className="text-green-400"
                />
            ) : null}
            {(incomplete && incomplete > 0) ? (
                <>
                    <TaskStatusItem
                        icon={XCircleIcon}
                        count={incomplete}
                        className="text-zinc-400"
                    />
                </>
            ) : null}
            {(unset && unset > 0) ? (
                <TaskStatusItem
                    icon={EllipsisHorizontalIcon}
                    count={unset || 0}
                    className="text-zinc-400"
                />
            ) : null}
        </div>
    );
};

const TimerDisplay = ({ time }: { time: number }) => {
    return (
        <div className="flex items-center text-zinc-200 space-x-1">
            <ClockIcon className="size-4" />
            <span className="text-lg font-medium">{renderTime(time)}</span>
        </div>
    )
}

const PinnedDisplay = ({ pinnedDesc }: { pinnedDesc: string }) => {
    // TODO: Consider adding date relative here
    return (
        <div className="flex items-center text-zinc-500 space-x-1 text-sm">
            <span>{pinnedDesc}</span>
        </div>
    )
}

const ResultCard = ({ tagData }: { tagData: AggregateDataOutput[number] }) => {
    return (
        <div className="relative">
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-sm p-4 flex flex-col space-y-2">
                <span className="text-sm">
                    {tagData.tag}
                </span>
                {tagData.pinned_at && (
                    <PinnedDisplay pinnedDesc={tagData.pinned_desc!} />
                )}
                <TaskStatusDisplay
                    complete={tagData.complete_tasks}
                    incomplete={tagData.incomplete_tasks}
                    unset={tagData.unset_tasks}
                />
                {tagData.total_time_seconds && (
                    <TimerDisplay time={tagData.total_time_seconds} />
                )}
            </div>
        </div>
    )
}

const AggregateData = ({ data }: { data: AggregateDataOutput }) => {
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

export const Aggregate = () => {
    const title = useDocTitle()

    const { data } = trpc.analysis.aggregateData.useQuery(
        { title: title! },
        { enabled: !!title }
    )

    return (
        <div className="p-4">
            {data && <AggregateData data={data} />}
            {!data || data.length === 0 &&
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-lg space-y-2 pt-4">
                    <CircleStackIcon className="size-8 text-zinc-500" />
                    <span>No tags with data in current document</span>
                    <span>See help for more information</span>
                </div>
            }
        </div>
    )
}