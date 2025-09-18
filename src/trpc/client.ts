import { createTRPCReact } from '@trpc/react-query'
import {
  createTRPCClient,
  httpLink,
  unstable_localLink,
  loggerLink,
} from '@trpc/client'
import { createTRPCJotai } from 'jotai-trpc'

import type { AppRouter } from './router'
import { appRouter } from './router'
import { dbHandle } from '@/db'

export const trpc = createTRPCReact<AppRouter>()

let trpcUrl: string | undefined

if (import.meta && import.meta.env && import.meta.env.TEKNE_TRPC_URL) {
  trpcUrl = import.meta.env.TEKNE_TRPC_URL
  console.log('[init] Using TRPC at backend ', trpcUrl)
} else if (!(typeof process !== 'undefined')) {
  console.log('[init] Using in-memory TRPC and database')
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: trpcUrl
    ? [httpLink({ url: trpcUrl })]
    : [
        loggerLink({
          enabled: (_opts) => {
            return true
          },
        }),
        unstable_localLink({
          router: appRouter,
          createContext: async () => ({ db: await dbHandle() }),
        }),
      ],
})

export const trpcJotai = createTRPCJotai<AppRouter>({
  links: trpcUrl
    ? [httpLink({ url: trpcUrl })]
    : [
        loggerLink({
          enabled: (_opts) => {
            return true
          },
        }),
        unstable_localLink({
          router: appRouter,
          createContext: async () => ({ db: await dbHandle() }),
        }),
      ],
})
