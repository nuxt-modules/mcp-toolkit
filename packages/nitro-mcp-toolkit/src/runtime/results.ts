import { HTTPError } from 'h3'
import type { CallToolResult, ContentBlock, InputRequiredResult } from 'h3-mcp'

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

/**
 * An explicit protocol result before Nitro fills an omitted text fallback.
 */
export type McpToolResult = Omit<CallToolResult, 'content'> & {
  content?: CallToolResult['content']
}

const explicitToolResults = new WeakSet<object>()

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * @internal
 */
export function isInputRequired(value: unknown): value is InputRequiredResult {
  return isObject(value) && value.resultType === 'input_required'
}

function isExplicitToolResult(value: object): value is CallToolResult {
  return explicitToolResults.has(value)
}

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

function finalizeToolResult(value: McpToolResult): CallToolResult {
  if (value.isError && !value.content?.length) {
    const text = value.structuredContent
      ? JSON.stringify(value.structuredContent)
      : 'Tool execution failed'
    return { ...value, content: textBlock(text) }
  }

  if (value.structuredContent && !value.content?.length) {
    return { ...value, content: textBlock(JSON.stringify(value.structuredContent)) }
  }

  return { ...value, content: value.content ?? [] }
}

/**
 * Mark a full protocol result as intentional.
 *
 * This disambiguates it from ordinary domain output when an `outputSchema` is
 * declared and that domain shape itself may contain protocol-looking keys.
 * `content` may be omitted when `structuredContent` is present; Nitro generates
 * the same text fallback it uses for other structured results.
 */
export function toolResult(result: McpToolResult): CallToolResult {
  const normalized = finalizeToolResult(result)
  explicitToolResults.add(normalized)
  return normalized
}

/**
 * Coerce a handler return into a `CallToolResult`.
 *
 * A tool that declares an `outputSchema` promises to return that shape, so the
 * value goes straight to `structuredContent` for the engine to validate.
 * Sniffing it for protocol keys instead would break any schema that happens
 * to describe a `content` array, and the schema could never be satisfied.
 * `toolResult()` is the explicit escape hatch when the handler intentionally
 * returns protocol fields alongside an output schema.
 *
 * @internal
 */
export function toCallToolResult(value: unknown, hasOutputSchema: boolean): CallToolResult {
  if (isObject(value) && isExplicitToolResult(value)) {
    return finalizeToolResult(value)
  }
  if (hasOutputSchema && isObject(value)) {
    return { content: textBlock(JSON.stringify(value, null, 2)), structuredContent: value }
  }
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
    return { content: textBlock(JSON.stringify(value, null, 2)) }
  }

  return finalizeToolResult(value)
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
