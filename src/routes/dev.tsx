import { createFileRoute } from '@tanstack/react-router'
import { FeatureFlags } from '@/dev/FeatureFlags'

export const Route = createFileRoute('/dev')({
  component: DevRoute,
})

function DevRoute() {
  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Developer Settings</h1>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', opacity: 0.7 }}>Feature Flags</h2>
      <FeatureFlags isActive={true} />
    </div>
  )
}
