// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  AssistantMessage,
  AssistantMessageEvent,
} from '@earendil-works/pi-ai'
import {
  DEFAULT_LLM_API_URL,
  DEFAULT_LLM_MODEL,
  resolveServerModel,
  sseFrame,
  toProxyEvent,
} from './agent-stream'

const partialWith = (
  content: AssistantMessage['content']
): AssistantMessage => ({
  role: 'assistant',
  content,
  api: 'openai-completions',
  provider: 'openrouter',
  model: 'test',
  stopReason: 'pending',
  usage: {
    input: 1,
    output: 2,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 3,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  timestamp: 0,
})

describe('resolveServerModel', () => {
  it('uses the OpenRouter catalog for the default model', () => {
    const model = resolveServerModel({})
    expect(model.id).toBe(DEFAULT_LLM_MODEL)
    expect(model.provider).toBe('openrouter')
    expect(model.baseUrl).toBe(DEFAULT_LLM_API_URL)
    // Catalog models carry real metadata
    expect(model.contextWindow).toBeGreaterThan(0)
  })

  it('honors LLM_MODEL for other catalog entries', () => {
    const model = resolveServerModel({ LLM_MODEL: 'openai/gpt-5.6-luna-pro' })
    expect(model.id).toBe('openai/gpt-5.6-luna-pro')
  })

  it('builds a generic literal for unknown models', () => {
    const model = resolveServerModel({ LLM_MODEL: 'acme/unknown-model' })
    expect(model.id).toBe('acme/unknown-model')
    expect(model.api).toBe('openai-completions')
    expect(model.baseUrl).toBe(DEFAULT_LLM_API_URL)
  })

  it('overrides the base URL with LLM_API_URL (trailing slash trimmed)', () => {
    const model = resolveServerModel({
      LLM_API_URL: 'https://llm.internal/v1/',
    })
    expect(model.baseUrl).toBe('https://llm.internal/v1')
    expect(model.id).toBe(DEFAULT_LLM_MODEL)
  })
})

describe('toProxyEvent', () => {
  it('strips partial from delta events', () => {
    const event: AssistantMessageEvent = {
      type: 'text_delta',
      contentIndex: 0,
      delta: 'hi',
      partial: partialWith([{ type: 'text', text: 'hi' }]),
    }
    expect(toProxyEvent(event)).toEqual({
      type: 'text_delta',
      contentIndex: 0,
      delta: 'hi',
    })
  })

  it('carries id and toolName on toolcall_start from the partial', () => {
    const event: AssistantMessageEvent = {
      type: 'toolcall_start',
      contentIndex: 0,
      partial: partialWith([
        { type: 'toolCall', id: 'call-1', name: 'edit', arguments: {} },
      ]),
    }
    expect(toProxyEvent(event)).toEqual({
      type: 'toolcall_start',
      contentIndex: 0,
      id: 'call-1',
      toolName: 'edit',
    })
  })

  it('reduces done to reason + usage', () => {
    const message = partialWith([{ type: 'text', text: 'ok' }])
    const event: AssistantMessageEvent = {
      type: 'done',
      reason: 'stop',
      message,
    }
    expect(toProxyEvent(event)).toEqual({
      type: 'done',
      reason: 'stop',
      usage: message.usage,
    })
  })

  it('reduces error to reason + message + usage', () => {
    const error = { ...partialWith([]), errorMessage: 'boom' }
    const event: AssistantMessageEvent = {
      type: 'error',
      reason: 'error',
      error,
    }
    expect(toProxyEvent(event)).toEqual({
      type: 'error',
      reason: 'error',
      errorMessage: 'boom',
      usage: error.usage,
    })
  })
})

describe('sseFrame', () => {
  it('formats a data: line with a blank-line terminator', () => {
    expect(sseFrame({ type: 'start' })).toBe('data: {"type":"start"}\n\n')
  })
})
