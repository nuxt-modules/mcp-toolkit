import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Create a text result for an MCP tool response.
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   handler: async () => textResult('Hello world')
 * })
 * ```
 */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

/**
 * Create a JSON result for an MCP tool response.
 * Automatically stringifies the data.
 *
 * @param data - The data to serialize as JSON
 * @param pretty - Whether to pretty-print the JSON (default: true)
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   handler: async () => jsonResult({ foo: 'bar', count: 42 })
 * })
 * ```
 */
export function jsonResult(data: unknown, pretty = true): CallToolResult {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  return { content: [{ type: 'text', text }] }
}

/**
 * Create an error result for an MCP tool response.
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   handler: async () => {
 *     if (!found) return errorResult('Resource not found')
 *     return textResult('Success')
 *   }
 * })
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
