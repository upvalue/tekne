import { AnimatedMetric } from '@/components/AnimatedMetric'
import { AnimatePresence, motion } from 'framer-motion'

import { renderTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { CircleCheck, CircleX, Clock, Ellipsis, Pin, Plus } from 'lucide-react'

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

type Metric = {
  icon: React.ComponentType<{ className?: string; size?: number }>
  value: string | null
  label: string
  className?: string
}

const metric = (
  icon: Metric['icon'],
  amount: number | undefined,
  label: string,
  className?: string,
  format: (n: number) => string = String
): Metric => ({
  icon,
  value: amount ? format(amount) : null,
  label,
  className,
})

/** All-time totals for the tag, shown large. */
const Totals = ({ tag }: { tag: ResultCardData }) => {
  const metrics = [
    metric(CircleCheck, tag.complete_tasks, 'done', 'text-done'),
    metric(Ellipsis, tag.unset_tasks, 'open', 'text-text-2'),
    metric(CircleX, tag.incomplete_tasks, 'cancelled', 'text-muted'),
    metric(Clock, tag.total_time_seconds, 'logged', 'text-text', renderTime),
  ].filter((m) => m.value)
  if (metrics.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
      aria-label="All-time totals"
    >
      {metrics.map(({ icon: Icon, value, label, className }) => (
        <span
          key={label}
          title={`${value} ${label}`}
          className={cn('flex items-center gap-1 whitespace-nowrap', className)}
        >
          <Icon size={16} className="shrink-0" />
          <span
            className={cn(
              'text-lg font-medium',
              label === 'logged' && 'font-mono'
            )}
          >
            <AnimatedMetric value={value!} />
          </span>
        </span>
      ))}
    </div>
  )
}

/** What this page adds to the totals, shown small beside the tag. */
const PageContribution = ({ tag }: { tag: ResultCardData }) => {
  const metrics = [
    metric(CircleCheck, tag.page_complete_tasks, 'done', 'text-done'),
    metric(Ellipsis, tag.page_unset_tasks, 'open'),
    metric(CircleX, tag.page_incomplete_tasks, 'cancelled'),
    metric(Clock, tag.page_time_seconds, 'logged', 'font-mono', renderTime),
  ].filter((m) => m.value)
  if (metrics.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"
      aria-label="On this page"
    >
      <Plus size={13} className="shrink-0" />
      {metrics.map(({ icon: Icon, value, label, className }) => (
        <span
          key={label}
          title={`${value} ${label} on this page`}
          className={cn('flex items-center gap-1 whitespace-nowrap', className)}
        >
          <Icon size={13} className="shrink-0" />
          <AnimatedMetric value={value!} />
        </span>
      ))}
    </div>
  )
}

export const ResultCard = ({ tag }: { tag: ResultCardData }) => (
  <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-white/[0.04] p-3">
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="min-w-0 text-sm font-medium text-accent [overflow-wrap:anywhere]">
        {tag.tag.startsWith('#') ? tag.tag : `#${tag.tag}`}
      </span>
      <PageContribution tag={tag} />
    </div>
    <Totals tag={tag} />
    {tag.pinned_at && tag.pinned_desc && (
      <p className="text-sm text-text-2 [overflow-wrap:anywhere]">
        <Pin size={12} className="mr-1 inline text-muted" />
        {tag.pinned_desc}
      </p>
    )}
  </div>
)

/** Masonry of tag cards; a second column appears once there is room. */
const CardMasonry = ({
  data,
  className,
}: {
  data: ResultCardData[]
  className?: string
}) => {
  return (
    <div className={cn('@container', className)}>
      <ul aria-label="Tag aggregates" className="gap-2 @md:columns-2">
        <AnimatePresence initial={false}>
          {data.map((tag) => (
            <motion.li
              key={tag.tag}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mb-2 break-inside-avoid"
            >
              <ResultCard tag={tag} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

/** The panel section is flush, so the list supplies its own inset. */
export const AggregateList = ({ data }: { data: ResultCardData[] }) => (
  <CardMasonry data={data} className="px-3" />
)

export const ResultCardGrid = ({ data }: { data: ResultCardData[] }) => (
  <CardMasonry data={data} />
)
