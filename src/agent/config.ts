// config.ts - Client-side discovery of the agent relay.

/**
 * Where the agent's stream relay lives. Mirrors how the tRPC client picks
 * its endpoint (src/trpc/client.ts): same origin in production; the
 * TEKNE_TRPC_URL origin when the client is pointed at a separate server;
 * unavailable in client-only dev, where no server process exists.
 */
export const resolveAgentProxy = (): {
  available: boolean
  baseUrl: string
} => {
  if (import.meta.env.PROD) return { available: true, baseUrl: '' }
  const trpcUrl: string | undefined = import.meta.env.TEKNE_TRPC_URL
  if (trpcUrl) {
    return { available: true, baseUrl: trpcUrl.replace(/\/api\/trpc\/?$/, '') }
  }
  return { available: false, baseUrl: '' }
}

export interface AgentAvailability {
  /** Server reachable and configured with an LLM API key */
  available: boolean
  reason?: string
}

/** Probes the server for whether the agent feature is usable. */
export const fetchAgentAvailability = async (
  baseUrl: string
): Promise<AgentAvailability> => {
  try {
    const res = await fetch(`${baseUrl}/api/agent/config`)
    if (!res.ok) {
      return { available: false, reason: `server responded ${res.status}` }
    }
    const body = (await res.json()) as { available: boolean }
    return body.available
      ? { available: true }
      : {
          available: false,
          reason: 'LLM_API_KEY is not configured on the server',
        }
  } catch {
    return { available: false, reason: 'agent server is not reachable' }
  }
}
