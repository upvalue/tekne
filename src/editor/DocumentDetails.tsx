import { LoadingIndicator } from '@/components/LoadingIndicator'
import { ErrorState } from '@/components/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/api/client'

export const DocumentDetails = ({ title }: { title: string }) => {
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
    <dl className="flex flex-wrap gap-x-3 text-[10px] leading-[14px] text-muted">
      <div className="flex gap-1">
        <dt>Created</dt>
        <dd>
          <time dateTime={data.createdAt.toISOString()}>
            {formatDate(data.createdAt)}
          </time>
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Updated</dt>
        <dd>
          <time dateTime={data.updatedAt.toISOString()}>
            {formatDate(data.updatedAt)}
          </time>
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Rev.</dt>
        <dd>{data.revision}</dd>
      </div>
    </dl>
  )
}
