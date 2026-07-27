import { createTRPCReact } from '@trpc/react-query'
import {
  createTRPCClient,
  httpLink,
  unstable_localLink,
  loggerLink,
  TRPCClientError,
  type OperationLink,
  type TRPCLink,
} from '@trpc/client'
import { observable, type Unsubscribable } from '@trpc/server/observable'

import type { AppRouter } from './router'

export const trpc = createTRPCReact<AppRouter>()

/**
 * The in-memory link, where the real router runs in the browser against a
 * PGlite database instead of talking to a backend.
 *
 * The router and the database are pulled in dynamically. They are only
 * reachable from the `else` branch of `resolveLinks`, which Rollup drops once
 * `import.meta.env.PROD` folds to `true` — a static import would put all five
 * routers, the migrations and ~14MB of PGlite wasm into every production
 * bundle, where nothing can ever call them.
 */
const loadInMemoryLink = async (): Promise<TRPCLink<AppRouter>> => {
  const [{ appRouter }, { dbHandle }] = await Promise.all([
    import('./router'),
    import('@/db'),
  ])

  return unstable_localLink({
    router: appRouter,
    createContext: async () => ({ db: await dbHandle() }),
  })
}

/**
 * Stands in for a link that has to be imported before it can be used.
 *
 * `createTRPCClient` initialises every link when the client is constructed,
 * which is too early to await anything, so the real link is loaded on the
 * first operation and reused from then on.
 */
const lazyLink = (
  load: () => Promise<TRPCLink<AppRouter>>
): TRPCLink<AppRouter> => {
  let pending: Promise<OperationLink<AppRouter>> | undefined

  return (runtime) => {
    return (opts) =>
      observable((observer) => {
        pending ??= load().then((link) => link(runtime))

        let inner: Unsubscribable | undefined
        let cancelled = false

        pending.then(
          (link) => {
            if (!cancelled) inner = link(opts).subscribe(observer)
          },
          (err) => observer.error(TRPCClientError.from(err))
        )

        return () => {
          cancelled = true
          inner?.unsubscribe()
        }
      })
  }
}

const resolveLinks = (): TRPCLink<AppRouter>[] => {
  if (import.meta.env.PROD) {
    // The production server serves the client and mounts tRPC on the same
    // origin; the in-memory database is a development-only convenience.
    const url = import.meta.env.TEKNE_TRPC_URL || '/api/trpc'
    console.log('[init] Using TRPC at backend ', url)
    return [httpLink({ url })]
  } else if (import.meta.env.TEKNE_TRPC_URL) {
    const url = import.meta.env.TEKNE_TRPC_URL
    console.log('[init] Using TRPC at backend ', url)
    return [httpLink({ url })]
  } else {
    console.log('[init] Using in-memory TRPC and database')
    return [
      loggerLink({
        enabled: () => {
          return true
        },
      }),
      lazyLink(loadInMemoryLink),
    ]
  }
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: resolveLinks(),
})
