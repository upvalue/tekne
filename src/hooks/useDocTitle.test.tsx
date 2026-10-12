import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { useDocTitle } from './useDocTitle'

afterEach(cleanup)

const Probe = () => (
  <span data-testid="title">{useDocTitle() ?? 'outside editor'}</span>
)

test.each([
  {
    path: `/n/${encodeURIComponent('Project / notes & 100%')}`,
    title: 'Project / notes & 100%',
  },
  { path: '/lab', title: 'outside editor' },
])('reads the route title at $path', async ({ path, title }) => {
  const root = createRootRoute({ component: Outlet })
  const routeTree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: '/n/$title',
      component: Probe,
    }),
    createRoute({ getParentRoute: () => root, path: '/lab', component: Probe }),
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  const view = render(<RouterProvider router={router} />)
  expect((await view.findByTestId('title')).textContent).toBe(title)
})
