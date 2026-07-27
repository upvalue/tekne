import { createFileRoute } from '@tanstack/react-router'
import { FeatureFlags } from '@/dev/FeatureFlags'

// Deliberately not '/dev': the development deployment is mounted at a /dev
// basepath, and TanStack Router strips the basepath from route paths too, so a
// route whose path equals the mount point collapses to '/' and shadows the
// index route. See src/lib/app-path.ts.
export const Route = createFileRoute('/dev-settings')({
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
