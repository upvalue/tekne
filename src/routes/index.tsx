import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
  loader: () => {
    const isDemoMode =
      !!import.meta.env.TEKNE_DEMO && import.meta.env.TEKNE_DEMO !== ''

    if (isDemoMode) {
      const hasVisitedDemo =
        localStorage.getItem('tekne-demo-visited') === 'true'

      if (!hasVisitedDemo) {
        throw redirect({
          to: '/demo',
        })
      }
    }

    const yyyymmdd = new Date().toLocaleDateString('en-CA')

    throw redirect({
      to: '/n/$title',
      params: {
        title: yyyymmdd,
      },
    })
  },
})

function RouteComponent() {
  return null
}
