// agent-stream.ts - SSE relay between the browser-side agent and the LLM.
//
// The client's pi streamProxy POSTs {model, context, options} to
// /api/stream; this route runs the actual provider call with server-held
// credentials and streams back the slim proxy event format (deltas without
// the `partial` field). The client-supplied model is ignored: provider,
// model, and key come exclusively from the server environment, keeping the
// app provider-agnostic (swap models by editing .env).

import express, { type Express, type Request, type Response } from 'express'
import {
  createModels,
  type Api,
  type AssistantMessageEvent,
  type Context,
  type Model,
} from '@earendil-works/pi-ai'
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter'
import type { ProxyAssistantMessageEvent } from '@earendil-works/pi-agent-core'

export const DEFAULT_LLM_API_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_LLM_MODEL = 'openai/gpt-5.6-luna'

export interface AgentEnv {
  LLM_API_KEY?: string
  LLM_API_URL?: string
  LLM_MODEL?: string
}

const models = createModels()
models.setProvider(openrouterProvider())

/**
 * The model the relay serves, from env alone. Known OpenRouter models come
 * from pi-ai's catalog (correct metadata); anything else gets a generic
 * OpenAI-compatible literal. A custom LLM_API_URL overrides the base URL
 * either way, so any OpenAI-compatible endpoint works.
 */
export const resolveServerModel = (env: AgentEnv): Model<Api> => {
  const id = env.LLM_MODEL || DEFAULT_LLM_MODEL
  const baseUrl = (env.LLM_API_URL || DEFAULT_LLM_API_URL).replace(/\/+$/, '')
  const catalogModel = models.getModel('openrouter', id)
  const model: Model<Api> = catalogModel ?? {
    id,
    name: id,
    api: 'openai-completions',
    provider: 'openrouter',
    baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 65_536,
  }
  return model.baseUrl === baseUrl ? model : { ...model, baseUrl }
}

/**
 * Maps a pi-ai stream event to the slim wire format streamProxy expects:
 * `partial` is dropped, end/start events carry only what the client can't
 * reconstruct from deltas.
 */
export const toProxyEvent = (
  event: AssistantMessageEvent
): ProxyAssistantMessageEvent | undefined => {
  switch (event.type) {
    case 'start':
      return { type: 'start' }
    case 'text_start':
    case 'thinking_start': {
      if (event.type === 'thinking_start') {
        return { type: 'thinking_start', contentIndex: event.contentIndex }
      }
      return { type: 'text_start', contentIndex: event.contentIndex }
    }
    case 'text_delta':
    case 'thinking_delta':
    case 'toolcall_delta':
      return {
        type: event.type,
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    case 'text_end': {
      const block = event.partial.content[event.contentIndex]
      return {
        type: 'text_end',
        contentIndex: event.contentIndex,
        contentSignature:
          block?.type === 'text' ? block.textSignature : undefined,
      }
    }
    case 'thinking_end': {
      const block = event.partial.content[event.contentIndex]
      return {
        type: 'thinking_end',
        contentIndex: event.contentIndex,
        contentSignature:
          block?.type === 'thinking' ? block.thinkingSignature : undefined,
      }
    }
    case 'toolcall_start': {
      const block = event.partial.content[event.contentIndex]
      if (block?.type !== 'toolCall') return undefined
      return {
        type: 'toolcall_start',
        contentIndex: event.contentIndex,
        id: block.id,
        toolName: block.name,
      }
    }
    case 'toolcall_end':
      return { type: 'toolcall_end', contentIndex: event.contentIndex }
    case 'done':
      return {
        type: 'done',
        reason: event.reason,
        usage: event.message.usage,
      }
    case 'error':
      return {
        type: 'error',
        reason: event.reason,
        errorMessage: event.error.errorMessage,
        usage: event.error.usage,
      }
    default:
      return undefined
  }
}

export const sseFrame = (event: ProxyAssistantMessageEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`

/** The subset of client-sent stream options the relay honors. */
const sanitizeOptions = (options: unknown) => {
  const o = (options ?? {}) as Record<string, unknown>
  return {
    temperature: typeof o.temperature === 'number' ? o.temperature : undefined,
    maxTokens: typeof o.maxTokens === 'number' ? o.maxTokens : undefined,
    reasoning: typeof o.reasoning === 'string' ? o.reasoning : undefined,
    sessionId: typeof o.sessionId === 'string' ? o.sessionId : undefined,
  } as Record<string, unknown>
}

export const registerAgentRoutes = (app: Express) => {
  // Availability probe for the panel's empty state
  app.get('/api/agent/config', (_req: Request, res: Response) => {
    res.json({ available: Boolean(process.env.LLM_API_KEY) })
  })

  // The context (system prompt + full doc + transcript) can exceed the
  // app-wide 100 KB json limit, hence the route-level parser. Registered
  // before the global express.json() in index.ts so this one wins.
  app.post(
    '/api/stream',
    express.json({ limit: '10mb' }),
    async (req: Request, res: Response) => {
      const apiKey = process.env.LLM_API_KEY
      if (!apiKey) {
        res.status(503).json({ error: 'LLM_API_KEY is not configured' })
        return
      }

      const body = req.body as { context?: Context; options?: unknown }
      if (!body?.context || !Array.isArray(body.context.messages)) {
        res.status(400).json({ error: 'missing context' })
        return
      }

      const model = resolveServerModel({
        LLM_API_KEY: process.env.LLM_API_KEY,
        LLM_API_URL: process.env.LLM_API_URL,
        LLM_MODEL: process.env.LLM_MODEL,
      })

      // `no-transform` keeps the compression() middleware from buffering
      // the stream; flushHeaders commits the SSE response immediately.
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const abort = new AbortController()
      // On the response, not the request: req 'close' fires as soon as the
      // request body is fully read, which would abort every call instantly.
      res.on('close', () => {
        if (!res.writableEnded) abort.abort()
      })

      try {
        const stream = models.streamSimple(model, body.context, {
          ...sanitizeOptions(body.options),
          apiKey,
          signal: abort.signal,
        })
        for await (const event of stream) {
          const proxyEvent = toProxyEvent(event)
          if (proxyEvent) res.write(sseFrame(proxyEvent))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        res.write(
          sseFrame({
            type: 'error',
            reason: abort.signal.aborted ? 'aborted' : 'error',
            errorMessage: message,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0,
              },
            },
          })
        )
      }
      res.end()
    }
  )
}
