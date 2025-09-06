import { useDocTitle } from '@/hooks/useDocTitle'
import { trpc } from '@/trpc'

export const Aggregate = () => {
    const title = useDocTitle()
    
    const { data } = trpc.analysis.aggregateData.useQuery(
        { title: title! },
        { enabled: !!title }
    )
    
    return (
        <div>
            <h2>Aggregate Data</h2>
            {data && data.length > 0 && (
                <pre>{JSON.stringify(data, null, 2)}</pre>
            )}
            {data && data.length === 0 && (
                <p>No aggregate data found</p>
            )}
        </div>
    )
}