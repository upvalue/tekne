import { useQuery } from '@tanstack/react-query'
import { useDocTitle } from '@/hooks/useDocTitle'
import { orpc } from '@/api/client'
import { ResultCardGrid } from './AggregateComponents'
import { Database } from 'lucide-react'

export const Aggregate = () => {
  const title = useDocTitle()

  const { data } = useQuery(
    orpc.analysis.aggregateData.queryOptions({
      input: { title: title! },
      enabled: !!title,
    })
  )

  return (
    <div className="p-4">
      {data && <ResultCardGrid data={data} />}
      {(!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-lg space-y-2 pt-4">
          <Database className="size-8 text-zinc-500" />
          <span>No tags with data in current document</span>
          <span>See help for more information</span>
        </div>
      )}
    </div>
  )
}
