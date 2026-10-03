import { createORPCClient, type ClientLink } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from './router'

export type { RouterOutputs } from './types'

// The demo and clients without a backend use the local router and PGlite.
// Server-backed production builds omit this branch and its imports.
const localLink = (): ClientLink<Record<string, never>> => {
  let pending: Promise<RouterClient<AppRouter>> | undefined
  return {
    async call(path, input, options) {
      pending ??= Promise.all([
        import('./router'),
        import('@/db'),
        import('@orpc/server'),
      ]).then(async ([{ appRouter }, { dbHandle }, { createRouterClient }]) =>
        createRouterClient(appRouter, { context: { db: await dbHandle() } })
      )
      let procedure: unknown = await pending
      for (const key of path) {
        procedure = (procedure as Record<string, unknown>)[key]
      }
      return (
        procedure as (input: unknown, options: unknown) => Promise<unknown>
      )(input, options)
    },
  }
}

export const orpcClient: RouterClient<AppRouter> = createORPCClient(
  !import.meta.env.TEKNE_DEMO &&
    (import.meta.env.PROD || import.meta.env.TEKNE_ORPC_URL)
    ? new RPCLink({
        url: () =>
          new URL(
            import.meta.env.TEKNE_ORPC_URL || '/api/rpc',
            window.location.href
          ),
      })
    : localLink()
)

export const orpc = createTanstackQueryUtils(orpcClient)
