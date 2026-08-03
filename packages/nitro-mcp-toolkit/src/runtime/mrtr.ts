import type { McpInputRequests, McpInputRequiredResult, McpInputResponses } from 'h3-mcp'

/**
 * What a retried request carried for a key. The three response kinds are told
 * apart by their own shape: an `action` member is an elicitation, a `roots`
 * array a roots listing, a `role` and `content` pair a sampling result.
 */
export type McpInputResponseView =
  | { kind: 'missing' }
  | { kind: 'elicit'; action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown> }
  | { kind: 'roots'; roots: { uri: string; name?: string }[] }
  | { kind: 'sampling'; role: string; content: unknown }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Ask the client for input by returning, rather than by calling it: the request
 * is answered with an interim result, and the client retries with the answers.
 *
 * @example
 * ```ts
 * return inputRequired({
 *   requests: {
 *     confirm: {
 *       method: 'elicitation/create',
 *       params: { message: 'Delete every entry?', requestedSchema },
 *     },
 *   },
 *   state: sign({ id }),
 * })
 * ```
 */
export function inputRequired(options: {
  /** What the server needs, keyed by a name the retry echoes back. */
  requests?: McpInputRequests
  /**
   * Opaque state handed back on the retry. It travels through the client, so
   * sign or encrypt anything that decides authorization.
   */
  state?: string
}): McpInputRequiredResult {
  const { requests, state } = options

  if (!requests && state === undefined) {
    throw new Error(
      '[nitro-mcp-toolkit] `inputRequired` needs `requests`, `state`, or both — an interim result that asks for nothing would stall the client.',
    )
  }

  return {
    resultType: 'input_required',
    ...(requests ? { inputRequests: requests } : {}),
    ...(state === undefined ? {} : { requestState: state }),
  }
}

/**
 * Read what the client answered for one key, discriminated by kind.
 *
 * Everything in it came from the client: validate it as you would a body.
 */
export function inputResponse(
  responses: McpInputResponses | undefined,
  key: string,
): McpInputResponseView {
  const response = responses?.[key]

  if (!isObject(response)) return { kind: 'missing' }

  if (typeof response.action === 'string') {
    const { action, content } = response
    return {
      kind: 'elicit',
      action: action === 'accept' || action === 'decline' ? action : 'cancel',
      ...(isObject(content) ? { content } : {}),
    }
  }

  if (Array.isArray(response.roots)) {
    return {
      kind: 'roots',
      roots: response.roots
        .filter(isObject)
        .flatMap((root) =>
          typeof root.uri === 'string'
            ? [{ uri: root.uri, ...(typeof root.name === 'string' ? { name: root.name } : {}) }]
            : [],
        ),
    }
  }

  if (typeof response.role === 'string' && 'content' in response) {
    return { kind: 'sampling', role: response.role, content: response.content }
  }

  return { kind: 'missing' }
}

/**
 * The content of an accepted elicitation, or `undefined` when the client
 * declined, cancelled, answered something else, or did not answer at all —
 * every case a handler treats the same way.
 */
export function acceptedContent(
  responses: McpInputResponses | undefined,
  key: string,
): Record<string, unknown> | undefined {
  const view = inputResponse(responses, key)

  return view.kind === 'elicit' && view.action === 'accept' ? view.content : undefined
}
