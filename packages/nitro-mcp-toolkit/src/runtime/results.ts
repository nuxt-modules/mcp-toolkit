import { HTTPError } from 'h3'
import type {
  McpCallToolResult,
  McpCompleteResult,
  McpContentBlock,
  McpInputRequiredResult,
} from 'h3-mcp'

/**
 * A plain value a handler may return instead of a full `McpCallToolResult`.
 */
export type McpToolValue =
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | Record<string, unknown>

/** A result as a handler may hand it over: `content` filled in below. */
type PartialResult = Omit<McpCallToolResult, 'content'> & { content?: McpContentBlock[] }

function isCallToolResult(value: object): value is PartialResult {
  return (
    ('content' in value && Array.isArray((value as PartialResult).content)) ||
    'structuredContent' in value ||
    'isError' in value
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function textBlock(text: string): McpContentBlock[] {
  return [{ type: 'text', text }]
}

/**
 * Whether a handler returned an interim multi-round-trip result, which must
 * reach the client untouched.
 *
 * @internal
 */
export function isInputRequired(value: unknown): value is McpInputRequiredResult {
  return isObject(value) && value.resultType === 'input_required'
}

/**
 * Coerce a handler return into an `McpCallToolResult`. A declared `outputSchema`
 * means the value *is* the output, so it is never sniffed for protocol keys —
 * a schema describing a `content` array could otherwise never be satisfied.
 *
 * @internal
 */
export function toCallToolResult(value: unknown, hasOutputSchema: boolean): McpCallToolResult {
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
 * Coerce a completion callback's return: the values alone are enough, unless it
 * wants to say the list is partial.
 *
 * @internal
 */
export function toCompleteResult(value: McpCompleteResult | string[]): McpCompleteResult {
  return Array.isArray(value) ? { values: value } : value
}

/**
 * Turn a thrown value into an error result, so a throwing handler answers the
 * client in-band instead of failing the whole request.
 *
 * @internal
 */
export function toErrorResult(error: unknown): McpCallToolResult {
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
export function imageResult(data: string, mimeType: string): McpCallToolResult {
  return { content: [{ type: 'image', data, mimeType }] }
}

/**
 * Build an audio result.
 *
 * @param data Base64-encoded audio data
 * @param mimeType e.g. `audio/mp3`
 */
export function audioResult(data: string, mimeType: string): McpCallToolResult {
  return { content: [{ type: 'audio', data, mimeType }] }
}
