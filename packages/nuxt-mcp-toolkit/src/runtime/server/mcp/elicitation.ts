import type { ZodRawShape } from 'zod'
import { z } from 'zod'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import type {
  ElicitRequestFormParams,
  ElicitRequestURLParams,
  ElicitResult,
} from '@modelcontextprotocol/sdk/types.js'
import { useMcpServer } from './server'

/**
 * Restricted JSON Schema property allowed by the MCP elicitation spec.
 * Only flat objects with primitive properties (or single-/multi-select enums) are accepted.
 */
type ElicitationPrimitiveSchema = Record<string, unknown>

interface ElicitationRequestedSchema {
  type: 'object'
  properties: Record<string, ElicitationPrimitiveSchema>
  required?: string[]
}

/**
 * Parameters for a form-mode elicitation request.
 *
 * The schema is provided as a Zod raw shape (matching `defineMcpTool`'s `inputSchema`).
 * It must produce a flat object with primitive properties — strings, numbers, booleans,
 * and single- or multi-select enums. Nested objects and arrays of objects are not
 * supported by the MCP spec and will throw.
 */
export interface ElicitationFormParams<S extends ZodRawShape> {
  /** Human-readable message displayed to the user. */
  message: string
  /** Zod raw shape describing the structured input the server is asking for. */
  schema: S
}

/**
 * Parameters for a URL-mode elicitation request.
 *
 * Use this for sensitive interactions that require redirecting the user to an
 * external page (auth flows, payment, account verification, …).
 */
export interface ElicitationUrlParams {
  /** Human-readable message displayed to the user before opening the URL. */
  message: string
  /** External URL the user should be redirected to. */
  url: string
}

export interface ElicitationFormResult<S extends ZodRawShape> {
  /** What the user did with the elicitation request. */
  action: 'accept' | 'decline' | 'cancel'
  /** The validated payload, present only when `action === 'accept'`. */
  content?: ShapeOutput<S>
}

export interface ElicitationUrlResult {
  /** What the user did with the elicitation request. */
  action: 'accept' | 'decline' | 'cancel'
}

/**
 * Mode-aware capability check.
 *
 * `'form'` is the default elicitation mode (always advertised when the client
 * declares `elicitation`); `'url'` is opt-in per spec 2025-11-25.
 */
export type ElicitationMode = 'form' | 'url'

/**
 * Error thrown by the elicitation composable when the request cannot be made
 * (capability missing, schema invalid, response shape unexpected, …).
 *
 * Catchable from inside tool/prompt/resource handlers to fall back to other
 * code paths.
 */
export class McpElicitationError extends Error {
  constructor(message: string, public readonly code: 'unsupported' | 'invalid-schema' | 'invalid-response') {
    super(message)
    this.name = 'McpElicitationError'
  }
}

export interface McpElicitation {
  /**
   * Ask the user for structured input via a form (default mode).
   *
   * The Zod shape is converted to the spec-restricted JSON Schema and the
   * client's response is validated against it before being returned.
   *
   * Throws `McpElicitationError('unsupported')` when the connected client did
   * not declare `elicitation` in its capabilities.
   */
  form<S extends ZodRawShape>(params: ElicitationFormParams<S>): Promise<ElicitationFormResult<S>>
  /**
   * Direct the user to an external URL (URL mode, MCP spec 2025-11-25).
   *
   * Throws `McpElicitationError('unsupported')` when the client did not
   * declare `elicitation.url` in its capabilities.
   */
  url(params: ElicitationUrlParams): Promise<ElicitationUrlResult>
  /**
   * Convenience yes/no prompt that resolves to `true` only when the user
   * accepts and confirms.
   */
  confirm(message: string): Promise<boolean>
  /**
   * Returns true when the connected client supports the given mode.
   *
   * Always false before the client's `initialize` round-trip completes.
   */
  supports(mode?: ElicitationMode): boolean
}

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean'])

function isPrimitiveLeaf(node: Record<string, unknown>): boolean {
  if (typeof node.type === 'string' && PRIMITIVE_TYPES.has(node.type)) return true
  if (Array.isArray(node.enum) && node.enum.every(v => typeof v === 'string')) return true
  return false
}

function flattenProperty(prop: Record<string, unknown>, key: string): ElicitationPrimitiveSchema {
  // Strip JSON Schema metadata that the spec rejects.
  const { $schema: _$schema, additionalProperties: _add, ...rest } = prop

  if (rest.type === 'array') {
    const items = rest.items as Record<string, unknown> | undefined
    if (!items || !isPrimitiveLeaf(items) || items.type !== 'string' || !Array.isArray(items.enum)) {
      throw new McpElicitationError(
        `Field "${key}" uses an array type that the MCP elicitation spec does not allow. `
        + 'Only arrays of string enums (multi-select) are supported.',
        'invalid-schema',
      )
    }
    return rest
  }

  if (!isPrimitiveLeaf(rest)) {
    throw new McpElicitationError(
      `Field "${key}" uses a type that the MCP elicitation spec does not allow `
      + '(only flat objects with primitive properties, enums, or string-enum arrays are accepted).',
      'invalid-schema',
    )
  }

  return rest
}

function shapeToRequestedSchema<S extends ZodRawShape>(shape: S): ElicitationRequestedSchema {
  const objectSchema = z.object(shape)
  const json = z.toJSONSchema(objectSchema, { unrepresentable: 'any' }) as {
    properties?: Record<string, Record<string, unknown>>
    required?: string[]
  }

  const properties = json.properties ?? {}
  const required = json.required ?? []

  const flatProps: Record<string, ElicitationPrimitiveSchema> = {}
  for (const [key, prop] of Object.entries(properties)) {
    flatProps[key] = flattenProperty(prop, key)
  }

  const result: ElicitationRequestedSchema = {
    type: 'object',
    properties: flatProps,
  }
  if (required.length > 0) result.required = required
  return result
}

function clientSupports(capabilities: { elicitation?: Record<string, unknown> } | undefined, mode: ElicitationMode): boolean {
  const elicitation = capabilities?.elicitation
  if (!elicitation) return false
  const hasForm = (elicitation as Record<string, unknown>).form !== undefined
  const hasUrl = (elicitation as Record<string, unknown>).url !== undefined
  if (mode === 'url') return hasUrl
  // Per MCP spec 2025-11-25: an empty `elicitation: {}` capability defaults
  // to form mode for backwards compatibility, otherwise form must be declared
  // explicitly when other modes (like `url`) are present.
  return hasForm || (!hasForm && !hasUrl)
}

/**
 * Returns an elicitation helper bound to the current MCP request.
 *
 * Must be called inside an MCP tool, resource, or prompt handler. Requires
 * `nitro.experimental.asyncContext: true` (same constraint as `useMcpServer`).
 *
 * @example
 * ```ts
 * const result = await useMcpElicitation().form({
 *   message: 'Pick a release channel',
 *   schema: { channel: z.enum(['stable', 'beta']) },
 * })
 * if (result.action === 'accept') {
 *   // result.content.channel is type-safe ('stable' | 'beta')
 * }
 * ```
 */
export function useMcpElicitation(): McpElicitation {
  const helper = useMcpServer()
  // The high-level `McpServer` exposes the underlying SDK `Server` via `.server`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkServer = (helper.server as any).server as {
    elicitInput: (params: ElicitRequestFormParams | ElicitRequestURLParams) => Promise<ElicitResult>
    getClientCapabilities: () => { elicitation?: Record<string, unknown> } | undefined
  }

  function supports(mode: ElicitationMode = 'form'): boolean {
    return clientSupports(sdkServer.getClientCapabilities(), mode)
  }

  async function form<S extends ZodRawShape>(params: ElicitationFormParams<S>): Promise<ElicitationFormResult<S>> {
    if (!supports('form')) {
      throw new McpElicitationError(
        'Client does not support elicitation (mode=form). The connected client did not declare the `elicitation` capability during initialization.',
        'unsupported',
      )
    }

    const requestedSchema = shapeToRequestedSchema(params.schema)

    const result = await sdkServer.elicitInput({
      mode: 'form',
      message: params.message,
      requestedSchema,
    } as ElicitRequestFormParams)

    if (result.action !== 'accept') {
      return { action: result.action }
    }

    const parsed = z.object(params.schema).safeParse(result.content ?? {})
    if (!parsed.success) {
      throw new McpElicitationError(
        `Client returned a payload that does not match the requested schema: ${parsed.error.message}`,
        'invalid-response',
      )
    }

    return { action: 'accept', content: parsed.data as ShapeOutput<S> }
  }

  async function url(params: ElicitationUrlParams): Promise<ElicitationUrlResult> {
    if (!supports('url')) {
      throw new McpElicitationError(
        'Client does not support elicitation (mode=url). URL-mode elicitation is opt-in per the MCP spec; the connected client did not declare `elicitation.url`.',
        'unsupported',
      )
    }

    const result = await sdkServer.elicitInput({
      mode: 'url',
      message: params.message,
      url: params.url,
      // The SDK populates `elicitationId` itself when the field is missing.
      elicitationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    } as ElicitRequestURLParams)

    return { action: result.action }
  }

  async function confirm(message: string): Promise<boolean> {
    const result = await form({
      message,
      schema: {
        confirm: z.boolean().describe('Confirm the action').default(false),
      },
    })
    return result.action === 'accept' && result.content?.confirm === true
  }

  return { form, url, confirm, supports }
}
