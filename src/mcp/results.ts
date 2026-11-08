import { ORPCError } from '@orpc/server'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const MAX_RESULT_BYTES = 512 * 1024

export function toolResult(
  value: Record<string, unknown>,
  isError = false
): CallToolResult {
  const text = JSON.stringify(value)
  if (new TextEncoder().encode(text).length > MAX_RESULT_BYTES) {
    return toolResult(
      {
        code: 'RESULT_TOO_LARGE',
        message:
          'Result exceeds 512 KiB. Narrow the search or use the HTTP API for a full document read. Nothing has been truncated.',
      },
      true
    )
  }
  return {
    content: [{ type: 'text', text }],
    structuredContent: JSON.parse(text),
    ...(isError ? { isError: true } : {}),
  }
}

export function toolError(error: unknown): CallToolResult {
  if (error instanceof ORPCError && error.status < 500) {
    return toolResult({ code: error.code, message: error.message }, true)
  }
  console.error('MCP operation failed', error)
  return toolResult(
    {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Operation failed. A write may have committed; retry edits with the same request ID and payload.',
    },
    true
  )
}

export async function runTool(
  action: () => Promise<CallToolResult>
): Promise<CallToolResult> {
  try {
    return await action()
  } catch (error) {
    return toolError(error)
  }
}
