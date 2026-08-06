// session.ts - Wires the pi agent loop to a document-edit session.
//
// The agent loop and the edit tool both run in the browser; LLM calls are
// relayed through the tekne server (which holds the credentials and picks
// the model) via pi's streamProxy. This is the only file that imports
// pi-agent-core.

import {
  Agent,
  streamProxy,
  type AgentTool,
  type AgentToolResult,
  type StreamFn,
} from '@earendil-works/pi-agent-core'
import type { Model } from '@earendil-works/pi-ai'
import type { ZDoc } from '@/docs/schema'
import {
  applyEditOps,
  summarizeOpResults,
  EditToolParams,
  type EditOp,
} from './edit-ops'
import { AGENT_SYSTEM_PROMPT, buildTaskMessage } from './prompt'

/**
 * streamProxy requires a Model object in its request body, but the server
 * resolves the real model from its own environment and ignores this one.
 * pi only uses it to fill bookkeeping fields on the reconstructed message.
 */
const STUB_MODEL: Model<'openai-completions'> = {
  id: 'server-configured',
  name: 'Server-configured model',
  api: 'openai-completions',
  provider: 'openrouter',
  baseUrl: '',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 0,
  maxTokens: 0,
}

export type TranscriptEntry =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolCallId: string; opCount: number; failures: number }

export interface AgentSessionState {
  status: 'idle' | 'running'
  /** The stream is currently inside a thinking block */
  thinking: boolean
  transcript: TranscriptEntry[]
  /** Bumped whenever the draft changes; memoize diffs against it */
  draftVersion: number
  error?: string
}

export interface AgentSession {
  getState(): AgentSessionState
  getDraft(): ZDoc
  getOps(): EditOp[]
  subscribe(cb: () => void): () => void
  /** Starts the session with the task instruction (first prompt). */
  start(instruction: string): void
  /** Sends a follow-up; queued as steering if the agent is still running. */
  send(text: string): void
  abort(): void
}

export const createAgentSession = (opts: {
  baseDoc: ZDoc
  proxyUrl: string
  /** Test seam; defaults to the server relay via streamProxy. */
  streamFn?: StreamFn
}): AgentSession => {
  let draft = opts.baseDoc
  const recordedOps: EditOp[] = []
  let state: AgentSessionState = {
    status: 'idle',
    thinking: false,
    transcript: [],
    draftVersion: 0,
  }
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const cb of listeners) cb()
  }
  const setState = (patch: Partial<AgentSessionState>) => {
    state = { ...state, ...patch }
    notify()
  }

  const editTool: AgentTool<typeof EditToolParams> = {
    name: 'edit',
    label: 'Edit document',
    description:
      'Apply a batch of operations to the working draft of the document. Operations apply in order; each sees the result of the previous one.',
    parameters: EditToolParams,
    execute: async (
      _toolCallId,
      params
    ): Promise<AgentToolResult<{ opCount: number; failures: number }>> => {
      const applied = applyEditOps(draft, params.ops)
      draft = applied.doc
      recordedOps.push(...params.ops)
      const failures = applied.results.filter((r) => !r.ok).length
      setState({ draftVersion: state.draftVersion + 1 })
      return {
        content: [{ type: 'text', text: summarizeOpResults(applied.results) }],
        details: { opCount: params.ops.length, failures },
      }
    },
  }

  const agent = new Agent({
    initialState: {
      systemPrompt: AGENT_SYSTEM_PROMPT,
      model: STUB_MODEL,
      tools: [editTool],
    },
    streamFn:
      opts.streamFn ??
      ((model, context, options) =>
        streamProxy(model, context, {
          ...options,
          proxyUrl: opts.proxyUrl,
          authToken: '',
        })),
  })

  const textOf = (message: unknown): string => {
    const content = (message as { content?: unknown }).content
    if (!Array.isArray(content)) return ''
    return content
      .filter(
        (c): c is { type: 'text'; text: string } =>
          typeof c === 'object' &&
          c !== null &&
          'type' in c &&
          c.type === 'text'
      )
      .map((c) => c.text)
      .join('')
  }

  const replaceLastText = (text: string) => {
    const transcript = [...state.transcript]
    const last = transcript[transcript.length - 1]
    if (last?.kind === 'text')
      transcript[transcript.length - 1] = { kind: 'text', text }
    else transcript.push({ kind: 'text', text })
    setState({ transcript })
  }

  agent.subscribe((event) => {
    switch (event.type) {
      case 'agent_start':
        setState({ status: 'running', error: undefined })
        break
      case 'agent_end':
        setState({ status: 'idle', thinking: false })
        break
      case 'message_start':
        if ('role' in event.message && event.message.role === 'assistant') {
          setState({
            transcript: [...state.transcript, { kind: 'text', text: '' }],
          })
        }
        break
      case 'message_update': {
        if (!('role' in event.message) || event.message.role !== 'assistant')
          break
        const streamEvent = event.assistantMessageEvent
        if (streamEvent.type === 'thinking_start') setState({ thinking: true })
        else if (
          streamEvent.type === 'thinking_end' ||
          streamEvent.type === 'text_start'
        )
          setState({ thinking: false })
        replaceLastText(textOf(event.message))
        break
      }
      case 'message_end': {
        const message = event.message
        if (!('role' in message) || message.role !== 'assistant') break
        replaceLastText(textOf(message))
        if (
          'stopReason' in message &&
          (message.stopReason === 'error' || message.stopReason === 'aborted')
        ) {
          const errorMessage =
            'errorMessage' in message &&
            typeof message.errorMessage === 'string'
              ? message.errorMessage
              : undefined
          setState({
            error:
              message.stopReason === 'aborted'
                ? undefined // user-initiated stop is not an error
                : (errorMessage ?? 'The model request failed.'),
          })
        }
        break
      }
      case 'tool_execution_end': {
        // Note: despite the AgentEvent type, the runtime does not include
        // `args` on this event -- counts ride on the tool result's details.
        const details = (event.result as { details?: unknown })?.details as
          | { opCount?: number; failures?: number }
          | undefined
        setState({
          transcript: [
            ...state.transcript,
            {
              kind: 'tool',
              toolCallId: event.toolCallId,
              opCount: details?.opCount ?? 0,
              failures: details?.failures ?? 0,
            },
          ],
        })
        break
      }
    }
  })

  return {
    getState: () => state,
    getDraft: () => draft,
    getOps: () => [...recordedOps],
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    start: (instruction) => {
      void agent.prompt(buildTaskMessage(instruction, opts.baseDoc))
    },
    send: (text) => {
      if (state.status === 'running') {
        agent.followUp({ role: 'user', content: text, timestamp: Date.now() })
      } else {
        void agent.prompt(text)
      }
    },
    abort: () => agent.abort(),
  }
}
