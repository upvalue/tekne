import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/open/$title')({
  component: RouteComponent,
})

/** Redirect through a separate route to force the current document to unmount. */
function RouteComponent() {
  const navigate = useNavigate()
  const title = Route.useParams({
    select: (p) => p.title,
  })

  useEffect(() => {
    void navigate({
      to: '/n/$title',
      params: {
        title: title,
      },
      replace: true,
    })
  }, [navigate, title])

  return null
}
