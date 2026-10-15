import { LoadingIndicator } from '@/components/LoadingIndicator'
import { ErrorState } from '@/components/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/api/client'
import { FileText } from 'lucide-react'
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@/components/vendor/Popover'

export const DocumentDetails = ({ title }: { title: string }) => (
  <Popover>
    <PopoverButton
      openOnHover
      aria-label="Document details"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted hover:bg-white/5 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
    >
      <FileText size={15} aria-hidden="true" />
    </PopoverButton>
    <PopoverPanel
      side="top"
      align="end"
      aria-label="Document details"
      className="OverlaySurface w-max max-w-[calc(100vw-24px)] p-3 text-xs text-text-2"
    >
      <div className="mb-2 font-medium text-text">Document details</div>
      <DocumentDetailsContent title={title} />
    </PopoverPanel>
  </Popover>
)

const DocumentDetailsContent = ({ title }: { title: string }) => {
  const { isLoading, data, error, refetch, isFetching } = useQuery(
    orpc.doc.loadDocDetails.queryOptions({ input: { name: title } })
  )

  if (isLoading) return <LoadingIndicator label="Loading document details" />
  if (error)
    return (
      <ErrorState
        title="Could not load document details"
        detail={error.message}
        onRetry={() => void refetch()}
        busy={isFetching}
      />
    )
  if (!data) return null

  const formatDate = (date: Date) =>
    date.toLocaleString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })

  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 whitespace-nowrap text-xs text-muted">
      <div className="contents">
        <dt>Created</dt>
        <dd>
          <time dateTime={data.createdAt.toISOString()}>
            {formatDate(data.createdAt)}
          </time>
        </dd>
      </div>
      <div className="contents">
        <dt>Updated</dt>
        <dd>
          <time dateTime={data.updatedAt.toISOString()}>
            {formatDate(data.updatedAt)}
          </time>
        </dd>
      </div>
      <div className="contents">
        <dt>Revision</dt>
        <dd>{data.revision}</dd>
      </div>
    </dl>
  )
}
