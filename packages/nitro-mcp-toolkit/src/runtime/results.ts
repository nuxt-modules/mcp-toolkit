import { HTTPError } from 'h3'
import type { CallToolResult, ContentBlock } from '@modelcontextprotocol/server'

/**
 * A plain value a handler may return instead of a full `CallToolResult`.
 */
export type McpToolValue =
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | Record<string, unknown>

function isCallToolResult(value: object): value is CallToolResult {
  return (
    ('content' in value && Array.isArray((value as CallToolResult).content)) ||
    'structuredContent' in value ||
    'isError' in value
  )
}

function textBlock(text: string): ContentBlock[] {
  return [{ type: 'text', text }]
}

/**
 * Coerce a handler return into a `CallToolResult`.
 *
 * When the tool declares an `outputSchema`, a plain value becomes
 * `structuredContent` (which the SDK validates) rather than only text — the
 * schema would otherwise never be satisfied.
 *
 * @internal
 */
export function toCallToolResult(value: unknown, hasOutputSchema: boolean): CallToolResult {
  if (typeof value === 'string') {
    return { content: textBlock(value) }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { content: textBlock(String(value)) }
  }
  if (value === null || value === undefined) {
    return { content: [] }
  }
  if (typeof value !== 'object') {
    return { content: textBlock(String(value)) }
  }

  if (!isCallToolResult(value)) {
    const text = JSON.stringify(value, null, 2)
    return hasOutputSchema
      ? { content: textBlock(text), structuredContent: value as Record<string, unknown> }
      : { content: textBlock(text) }
  }

  if (value.isError && !value.content?.length) {
    const text = value.structuredContent
      ? JSON.stringify(value.structuredContent)
      : 'Tool execution failed'
    return { ...value, content: textBlock(text) }
  }

  if (value.structuredContent && !value.content?.length) {
    return { ...value, content: textBlock(JSON.stringify(value.structuredContent)) }
  }

  return value
}

/**
 * Turn a thrown value into an error result, so a throwing handler answers the
 * client in-band instead of failing the whole request.
 *
 * @internal
 */
export function toErrorResult(error: unknown): CallToolResult {
  if (error instanceof HTTPError) {
    let text = `[${error.status}] ${error.message}`
    if (error.data != null) {
      text += `\n${JSON.stringify(error.data, null, 2)}`
    }
    return { content: textBlock(text), isError: true }
  }
  if (error instanceof Error) {
    return { content: textBlock(error.message), isError: true }
  }
  return { content: textBlock(String(error)), isError: true }
}

/**
 * Build an image result. Use it when a tool answers with an image rather than
 * text; anything else can be returned directly from the handler.
 *
 * @param data Base64-encoded image data
 * @param mimeType e.g. `image/png`
 */
export function imageResult(data: string, mimeType: string): CallToolResult {
  return { content: [{ type: 'image', data, mimeType }] }
}

/**
 * Build an audio result.
 *
 * @param data Base64-encoded audio data
 * @param mimeType e.g. `audio/mp3`
 */
export function audioResult(data: string, mimeType: string): CallToolResult {
  return { content: [{ type: 'audio', data, mimeType }] }
}
