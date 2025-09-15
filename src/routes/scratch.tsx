// scratch.tsx - route for just messing with anything
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/scratch')({
  component: ScratchRoute,
})

function ScratchRoute() {
  return (
    <div className="min-h-screen w-full bg-zinc-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-16">
        hi
      </div>
    </div>
  )
}
