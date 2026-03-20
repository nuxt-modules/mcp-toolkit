import type { H3Event } from 'h3'
import { readBody } from 'h3'

/**
 * Extract the names of tools being called from an MCP JSON-RPC request.
 *
 * Parses the request body for `tools/call` JSON-RPC messages and returns
 * the tool names. Useful in middleware for logging, monitoring, or access control.
 *
 * @example
 * ```ts
 * export default defineMcpHandler({
 *   middleware: async (event, next) => {
 *     const toolNames = await extractToolNames(event)
 *     console.log(`Calling tools: ${toolNames.join(', ')}`)
 *     return next()
 *   },
 * })
 * ```
 */
export async function extractToolNames(event: H3Event): Promise<string[]> {
  let body: unknown
  try {
    body = await readBody(event)
  }
  catch {
    return []
  }

  if (!body) {
    return []
  }

  const messages: unknown[] = Array.isArray(body) ? body : [body]
  const toolNames: string[] = []

  for (const message of messages) {
    if (
      typeof message !== 'object'
      || message === null
      || !('method' in message)
      || (message as { method: unknown }).method !== 'tools/call'
    ) {
      continue
    }

    const params = (message as { params?: unknown }).params
    if (
      typeof params === 'object'
      && params !== null
      && 'name' in params
      && typeof (params as { name: unknown }).name === 'string'
    ) {
      toolNames.push((params as { name: string }).name)
    }
  }

  return toolNames
}
