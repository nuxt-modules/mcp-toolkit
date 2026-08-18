import { McpJsonRpcError } from 'h3-mcp'
import type { H3Event } from 'h3'
import type { McpInputRequest, McpInputRequests, McpInputRequiredResult } from 'h3-mcp'

/**
 * An `elicitation/create` request — a form the client shows the user.
 */
export function mcpElicit(params: {
  message: string
  requestedSchema: Record<string, unknown>
}): McpInputRequest {
  return { method: 'elicitation/create', params }
}

/**
 * An `elicitation/create` request that points the user at an out-of-band URL.
 */
export function mcpElicitUrl(params: { message: string; url: string }): McpInputRequest {
  return { method: 'elicitation/create', params: { ...params, mode: 'url' } }
}

/**
 * Build the `resultType: "input_required"` interim result to return from a
 * handler. Refuses a legacy request, which cannot carry the field.
 */
export function inputRequired(
  event: H3Event,
  spec: { inputRequests?: McpInputRequests; requestState?: string },
): McpInputRequiredResult {
  if (event.context.mcp?.era === 'legacy') {
    throw new McpJsonRpcError(-32_022, 'input_required requires protocol 2026-07-28')
  }

  if (!spec.inputRequests && spec.requestState === undefined) {
    throw new McpJsonRpcError(-32_603, 'input_required needs inputRequests or requestState')
  }

  return { resultType: 'input_required', ...spec }
}

/**
 * The submitted fields of an accepted form elicitation, or `undefined` when
 * the answer is missing, declined, or cancelled.
 */
export function getElicitedContent<T = Record<string, unknown>>(
  event: H3Event,
  requests: Record<string, McpInputRequest>,
  key: string,
): T | undefined
export function getElicitedContent<T = Record<string, unknown>>(
  event: H3Event,
  key: string,
): T | undefined
export function getElicitedContent<T = Record<string, unknown>>(
  event: H3Event,
  requestsOrKey: Record<string, McpInputRequest> | string,
  key?: string,
): T | undefined {
  const name = typeof requestsOrKey === 'string' ? requestsOrKey : key
  if (name === undefined) {
    throw new TypeError('[nitro-mcp-toolkit] getElicitedContent needs a key')
  }

  if (typeof requestsOrKey !== 'string' && !(name in requestsOrKey)) {
    throw new TypeError(
      `[nitro-mcp-toolkit] getElicitedContent key ${JSON.stringify(name)} is not in the request map`,
    )
  }

  const answer = event.context.mcp?.inputResponses?.[name]
  if (!answer || typeof answer !== 'object') return undefined

  const result = answer as { action?: string; content?: T }
  if (result.action !== undefined && result.action !== 'accept') return undefined

  return result.content
}
