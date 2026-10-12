import { useQuery } from '@tanstack/react-query'
import { useDocTitle } from '@/hooks/useDocTitle'
import { orpc } from '@/api/client'
import { AggregateList } from './AggregateComponents'

export const Aggregate = () => {
  const title = useDocTitle()

  const { data } = useQuery(
    orpc.analysis.aggregateData.queryOptions({
      input: { title: title! },
      enabled: !!title,
    })
  )

  return data && data.length > 0 ? (
    <AggregateList data={data} />
  ) : (
    <div className="flex flex-col  text-muted text-sm gap-2 px-3 py-4">
      <span>No tags with data in current document</span>
    </div>
  )
}
