import { createFileRoute } from '@tanstack/react-router'
import { trpc } from '@/trpc/client'

export const Route = createFileRoute('/trpc-test')({
  component: TrpcTestPage,
})

function TrpcTestPage() {
  const pingQuery = trpc.ping.useQuery()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">tRPC Test</h1>
      <div className="whitespace-pre-wrap font-mono">
        <div>tRPC Status: {pingQuery.isLoading ? 'Loading...' : 'Ready'}</div>
        <div>Ping Response: {pingQuery.data || 'No response'}</div>
      </div>
    </div>
  )
}
