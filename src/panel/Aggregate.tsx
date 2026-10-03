import { useQuery } from '@tanstack/react-query'
import { useDocTitle } from '@/hooks/useDocTitle'
import { orpc } from '@/api/client'
import { AggregateList } from './AggregateComponents'
import { Database } from 'lucide-react'

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
    <div className="flex flex-col items-center justify-center text-center text-zinc-500 text-sm gap-2 px-3 py-4">
      <Database className="size-8 text-zinc-500" />
      <span>No tags with data in current document</span>
      <span>See help for more information</span>
    </div>
  )
}
