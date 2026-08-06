// @vitest-environment node
//
// End-to-end test of the agent stack minus the real LLM and the React UI:
// a mock OpenAI-compatible endpoint stands in for OpenRouter, the real
// Express relay (including compression, as in production) streams proxy
// events, and the real browser-side session drives the edit tool loop.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import compression from 'compression'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { registerAgentRoutes } from './agent-stream'
import { createAgentSession } from '@/agent/session'
import { docMake, lineMake } from '@/docs/schema'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const listen = (app: express.Express): Promise<Server> =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })

const portOf = (server: Server) => (server.address() as AddressInfo).port

const sseChunk = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`

const chunkEnvelope = (delta: unknown, finish: string | null = null) => ({
  id: 'chatcmpl-mock',
  object: 'chat.completion.chunk',
  created: 1,
  model: 'mock/model',
  choices: [{ index: 0, delta, finish_reason: finish }],
})

/**
 * Scripted two-turn model: first a tool call editing the doc, then a text
 * wrap-up. Standard OpenAI streaming chunk format.
 */
const makeMockLlm = () => {
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  let requests = 0
  app.post('/v1/chat/completions', (req, res) => {
    requests++
    res.setHeader('Content-Type', 'text/event-stream')
    const write = (payload: unknown) => res.write(sseChunk(payload))
    if (requests === 1) {
      const args = JSON.stringify({
        ops: [
          { op: 'replace', id: iso(0), mdContent: 'alpha reworded' },
          {
            op: 'insert_after',
            id: iso(1),
            lines: [{ mdContent: 'appended by agent', indent: 1 }],
          },
        ],
      })
      write(
        chunkEnvelope({
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'edit', arguments: '' },
            },
          ],
        })
      )
      write(
        chunkEnvelope({
          tool_calls: [{ index: 0, function: { arguments: args } }],
        })
      )
      write(chunkEnvelope({}, 'tool_calls'))
    } else {
      write(chunkEnvelope({ role: 'assistant', content: '' }))
      write(chunkEnvelope({ content: 'Done. Reworded and appended.' }))
      write(chunkEnvelope({}, 'stop'))
    }
    res.write(
      sseChunk({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'mock/model',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    )
    res.write('data: [DONE]\n\n')
    res.end()
  })
  return app
}

describe('agent relay end-to-end', () => {
  let llmServer: Server
  let relayServer: Server
  const savedEnv = { ...process.env }

  beforeAll(async () => {
    llmServer = await listen(makeMockLlm())
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_API_URL = `http://127.0.0.1:${portOf(llmServer)}/v1`
    process.env.LLM_MODEL = 'mock/model'

    const relay = express()
    relay.use(compression()) // as in src/server/index.ts
    registerAgentRoutes(relay)
    relayServer = await listen(relay)
  })

  afterAll(async () => {
    process.env.LLM_API_KEY = savedEnv.LLM_API_KEY
    process.env.LLM_API_URL = savedEnv.LLM_API_URL
    process.env.LLM_MODEL = savedEnv.LLM_MODEL
    await new Promise((r) => llmServer.close(r))
    await new Promise((r) => relayServer.close(r))
  })

  it('reports availability', async () => {
    const res = await fetch(
      `http://127.0.0.1:${portOf(relayServer)}/api/agent/config`
    )
    expect(await res.json()).toEqual({ available: true })
  })

  it('runs the edit tool loop through the relay', async () => {
    const baseDoc = docMake([
      lineMake(0, 'alpha', { timeCreated: iso(0) }),
      lineMake(0, 'beta', { timeCreated: iso(1) }),
    ])
    const session = createAgentSession({
      baseDoc,
      proxyUrl: `http://127.0.0.1:${portOf(relayServer)}`,
    })

    const idle = new Promise<void>((resolve) => {
      const unsub = session.subscribe(() => {
        const s = session.getState()
        if (s.status === 'idle' && s.transcript.length > 0) {
          unsub()
          resolve()
        }
      })
    })
    session.start('Reword the first line and append a child to the second')
    await idle

    const state = session.getState()
    expect(state.error).toBeUndefined()

    const draft = session.getDraft()
    expect(draft.children.map((l) => l.mdContent)).toEqual([
      'alpha reworded',
      'beta',
      'appended by agent',
    ])
    expect(draft.children[2].indent).toBe(1)

    const tools = state.transcript.filter((e) => e.kind === 'tool')
    expect(tools).toEqual([
      { kind: 'tool', toolCallId: 'call_1', opCount: 2, failures: 0 },
    ])
    const texts = state.transcript.filter((e) => e.kind === 'text')
    expect(texts.at(-1)?.text).toContain('Done.')

    expect(baseDoc.children[0].mdContent).toBe('alpha')
  }, 15_000)

  it('503s without a key', async () => {
    const key = process.env.LLM_API_KEY
    delete process.env.LLM_API_KEY
    try {
      const res = await fetch(
        `http://127.0.0.1:${portOf(relayServer)}/api/stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: { messages: [] } }),
        }
      )
      expect(res.status).toBe(503)
    } finally {
      process.env.LLM_API_KEY = key
    }
  })
})
