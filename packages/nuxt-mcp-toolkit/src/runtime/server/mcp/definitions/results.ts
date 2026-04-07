import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Simplified return types accepted by tool handlers.
 *
 * - `string` / `number` / `boolean` → `{ content: [{ type: 'text', text: '...' }] }`
 * - plain object / array → JSON-stringified into a text content item
 * - `CallToolResult` → passed through (with auto-fallbacks for missing `content`)
 */
export type McpToolCallbackResult = CallToolResult | string | number | boolean | Record<string, unknown> | unknown[]

function isCallToolResult(value: object): value is CallToolResult {
  return (
    ('content' in value && Array.isArray((value as CallToolResult).content))
    || 'structuredContent' in value
    || 'isError' in value
  )
}

/**
 * Normalize a simplified tool return into a full `CallToolResult`.
 *
 * - Primitives (`string`, `number`, `boolean`) are wrapped in text content
 * - Plain objects / arrays are JSON-stringified
 * - `isError` without `content` gets auto-generated fallback text
 * - `structuredContent` without `content` gets a JSON text fallback
 *
 * @internal
 */
export function normalizeToolResult(result: McpToolCallbackResult): CallToolResult {
  if (typeof result === 'string') {
    return { content: [{ type: 'text', text: result }] }
  }
  if (typeof result === 'number' || typeof result === 'boolean') {
    return { content: [{ type: 'text', text: String(result) }] }
  }
  if (typeof result === 'object' && result !== null && !isCallToolResult(result)) {
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }

  const callResult = result as CallToolResult

  // Auto-generate fallback content for isError responses without content (MCP-17)
  if (callResult.isError && !callResult.content?.length) {
    const fallbackText = callResult.structuredContent
      ? JSON.stringify(callResult.structuredContent)
      : 'Tool execution failed'
    return { ...callResult, content: [{ type: 'text', text: fallbackText }] }
  }

  // Auto-generate text fallback when only structuredContent is provided
  if (callResult.structuredContent && !callResult.content?.length) {
    return {
      ...callResult,
      content: [{ type: 'text', text: JSON.stringify(callResult.structuredContent) }],
    }
  }

  return callResult
}

/**
 * Create a text result for an MCP tool response.
 *
 * @deprecated Return the string directly from your handler instead.
 *
 * @example
 * ```ts
 * // Before
 * handler: async () => textResult('Hello world')
 *
 * // After
 * handler: async () => 'Hello world'
 * ```
 */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

/**
 * Create a JSON result for an MCP tool response.
 * Automatically stringifies the data.
 *
 * @deprecated Return the object or array directly from your handler instead.
 *
 * @param data - The data to serialize as JSON
 * @param pretty - Whether to pretty-print the JSON (default: true)
 *
 * @example
 * ```ts
 * // Before
 * handler: async () => jsonResult({ foo: 'bar', count: 42 })
 *
 * // After
 * handler: async () => ({ foo: 'bar', count: 42 })
 * ```
 */
export function jsonResult(data: unknown, pretty = true): CallToolResult {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  return { content: [{ type: 'text', text }] }
}

/**
 * Create an error result for an MCP tool response.
 *
 * @deprecated Throw an error directly from your handler instead.
 * H3 errors (`createError()`) are also supported.
 *
 * @example
 * ```ts
 * // Before
 * handler: async () => {
 *   if (!found) return errorResult('Resource not found')
 *   return textResult('Success')
 * }
 *
 * // After
 * handler: async () => {
 *   if (!found) throw createError({ statusCode: 404, message: 'Resource not found' })
 *   return 'Success'
 * }
 * ```
 */
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

/**
 * Create an image result for an MCP tool response.
 *
 * @param data - Base64-encoded image data
 * @param mimeType - The MIME type of the image (e.g., 'image/png', 'image/jpeg')
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   handler: async () => imageResult(base64Data, 'image/png')
 * })
 * ```
 */
export function imageResult(data: string, mimeType: string): CallToolResult {
  return { content: [{ type: 'image', data, mimeType }] }
}

/**
 * Create an audio result for an MCP tool response.
 *
 * @param data - Base64-encoded audio data
 * @param mimeType - The MIME type of the audio (e.g., 'audio/mp3', 'audio/wav', 'audio/ogg')
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   handler: async () => audioResult(base64Audio, 'audio/mp3')
 * })
 * ```
 */
export function audioResult(data: string, mimeType: string): CallToolResult {
  return { content: [{ type: 'audio', data, mimeType }] }
}
