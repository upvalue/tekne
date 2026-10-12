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

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs text-muted">
      <dt>Created</dt>
      <dd>
        <time dateTime={data.createdAt.toISOString()}>
          {data.createdAt.toLocaleString()}
        </time>
      </dd>
      <dt>Updated</dt>
      <dd>
        <time dateTime={data.updatedAt.toISOString()}>
          {data.updatedAt.toLocaleString()}
        </time>
      </dd>
      <dt>Revision</dt>
      <dd>{data.revision}</dd>
    </dl>
  )
}
