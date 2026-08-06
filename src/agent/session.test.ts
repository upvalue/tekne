import { describe, expect, it } from 'vitest'
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type ToolCall,
} from '@earendil-works/pi-ai'
import type { StreamFn } from '@earendil-works/pi-agent-core'
import { docMake, lineMake } from '@/docs/schema'
import { createAgentSession } from './session'

const iso = (ms: number) =>
  `2024-01-01T00:00:00.${String(ms).padStart(3, '0')}Z`

const baseDoc = () =>
  docMake([
    lineMake(0, 'alpha', { timeCreated: iso(0) }),
    lineMake(0, 'beta', { timeCreated: iso(1) }),
  ])

const assistantMessage = (
  content: AssistantMessage['content'],
  stopReason: AssistantMessage['stopReason']
): AssistantMessage => ({
  role: 'assistant',
  content,
  api: 'openai-completions',
  provider: 'openrouter',
  model: 'test-model',
  stopReason,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  timestamp: Date.now(),
})

/**
 * A streamFn that emits a scripted sequence of turns: first a tool call
 * (driving the edit tool), then a plain-text wrap-up.
 */
const scriptedStreamFn = (toolCalls: ToolCall[][]): StreamFn => {
  let turn = 0
  return () => {
    const stream = createAssistantMessageEventStream()
    const calls = toolCalls[turn]
    turn++
    if (calls && calls.length > 0) {
      const message = assistantMessage(calls, 'toolUse')
      stream.push({ type: 'start', partial: message })
      stream.push({ type: 'done', reason: 'toolUse', message })
      stream.end(message)
    } else {
      const message = assistantMessage(
        [{ type: 'text', text: 'Done. Reworded the first line.' }],
        'stop'
      )
      stream.push({ type: 'start', partial: message })
      stream.push({ type: 'done', reason: 'stop', message })
      stream.end(message)
    }
    return stream
  }
}

const waitForIdle = (session: ReturnType<typeof createAgentSession>) =>
  new Promise<void>((resolve) => {
    const unsub = session.subscribe(() => {
      if (session.getState().status === 'idle') {
        unsub()
        resolve()
      }
    })
  })

describe('createAgentSession', () => {
  it('executes edit tool calls against the draft and records ops', async () => {
    const session = createAgentSession({
      baseDoc: baseDoc(),
      proxyUrl: 'unused',
      streamFn: scriptedStreamFn([
        [
          {
            type: 'toolCall',
            id: 'call-1',
            name: 'edit',
            arguments: {
              ops: [
                { op: 'replace', id: iso(0), mdContent: 'alpha reworded' },
                { op: 'delete', id: iso(1) },
              ],
            },
          },
        ],
      ]),
    })

    const idle = waitForIdle(session)
    session.start('Reword the first line and drop the second')
    await idle

    const draft = session.getDraft()
    expect(draft.children.map((l) => l.mdContent)).toEqual(['alpha reworded'])
    expect(session.getOps()).toHaveLength(2)
    expect(session.getState().error).toBeUndefined()
    expect(session.getState().draftVersion).toBeGreaterThan(0)

    const toolEntries = session
      .getState()
      .transcript.filter((e) => e.kind === 'tool')
    expect(toolEntries).toEqual([
      { kind: 'tool', toolCallId: 'call-1', opCount: 2, failures: 0 },
    ])
  })

  it('feeds per-op failures back and counts them in the transcript', async () => {
    const session = createAgentSession({
      baseDoc: baseDoc(),
      proxyUrl: 'unused',
      streamFn: scriptedStreamFn([
        [
          {
            type: 'toolCall',
            id: 'call-1',
            name: 'edit',
            arguments: {
              ops: [
                { op: 'replace', id: 'bogus', mdContent: 'x' },
                { op: 'replace', id: iso(1), mdContent: 'beta!' },
              ],
            },
          },
        ],
      ]),
    })

    const idle = waitForIdle(session)
    session.start('test')
    await idle

    expect(session.getDraft().children[1].mdContent).toBe('beta!')
    const toolEntries = session
      .getState()
      .transcript.filter((e) => e.kind === 'tool')
    expect(toolEntries[0]).toMatchObject({ opCount: 2, failures: 1 })
  })

  it('leaves the base doc untouched and finishes with the assistant summary', async () => {
    const doc = baseDoc()
    const snapshot = JSON.parse(JSON.stringify(doc))
    const session = createAgentSession({
      baseDoc: doc,
      proxyUrl: 'unused',
      streamFn: scriptedStreamFn([
        [
          {
            type: 'toolCall',
            id: 'call-1',
            name: 'edit',
            arguments: {
              ops: [
                {
                  op: 'insert_after',
                  id: null,
                  lines: [{ mdContent: 'top', indent: 0 }],
                },
              ],
            },
          },
        ],
      ]),
    })

    const idle = waitForIdle(session)
    session.start('test')
    await idle

    expect(doc).toEqual(snapshot)
    const texts = session
      .getState()
      .transcript.filter((e) => e.kind === 'text')
      .map((e) => e.text)
    expect(texts.at(-1)).toContain('Done.')
  })
})
