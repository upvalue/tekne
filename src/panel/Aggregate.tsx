import { ErrorState } from '@/components/ErrorState'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import { useDocTitle } from '@/hooks/useDocTitle'
import { useLiveAggregates } from './useLiveAggregates'
import { AggregateList } from './AggregateComponents'

export const Aggregate = () => {
  const title = useDocTitle()

  const { data, error, refetch, isFetching, ready } = useLiveAggregates(title)

  if (title && !ready)
    return (
      <div className="px-3">
        <LoadingIndicator label="Loading aggregate data" />
      </div>
    )
  const errorState = error ? (
    <ErrorState
      title="Could not load aggregate data"
      detail={error.message}
      onRetry={() => void refetch()}
      busy={isFetching}
    />
  ) : null

  return data && data.length > 0 ? (
    <>
      {errorState}
      <AggregateList data={data} />
    </>
  ) : (
    (errorState ?? (
      <div className="flex flex-col  text-muted text-sm gap-2 px-3 py-4">
        <span>No tags with data in current document</span>
      </div>
    ))
  )
}
