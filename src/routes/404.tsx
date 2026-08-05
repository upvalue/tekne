import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '@/layout/NotFound'

export const Route = createFileRoute('/404')({
  component: NotFound,
})
