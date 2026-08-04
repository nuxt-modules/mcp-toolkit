import type { H3Event } from 'h3'

export type McpAuthScheme = 'bearer' | 'api-key'

/** A credential as it arrived: which form it took, and its bare value. */
export interface McpAuthCredential {
  scheme: McpAuthScheme
  token: string
}

export interface McpAuthOptions {
  /**
   * Which credential forms are accepted, tried in this order.
   *
   * @default ['bearer', 'api-key']
   */
  schemes?: McpAuthScheme[]
  /**
   * The header an `api-key` credential is read from.
   *
   * @default 'x-api-key'
   */
  header?: string
  /** A static allow-list, compared safely against the presented credential. */
  tokens?: string[]
  /**
   * Validate a credential yourself — a JWT, a per-tenant key, a lookup.
   * Stash whatever you resolve on `event.context` for handlers to read;
   * auth runs before any of them.
   */
  validate?: (auth: McpAuthCredential, event: H3Event) => boolean | Promise<boolean>
  /**
   * Where clients can discover this server's authorization server (RFC 9728).
   * Carried on every `401` challenge. Requires the `bearer` scheme.
   */
  resourceMetadataUrl?: string
}

/** @internal */
export type McpAuthGate = (event: H3Event) => Promise<Response | undefined>

const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const MAX_CREDENTIAL_LENGTH = 8192

function assertValid(options: McpAuthOptions): void {
  if (!options.tokens?.length && !options.validate) {
    throw new Error(
      '[nitro-mcp-toolkit] `auth` needs at least one of `tokens` or `validate` — a config with ' +
        'neither would accept every request.',
    )
  }

  if (options.header !== undefined && !HEADER_NAME_RE.test(options.header)) {
    throw new Error(
      `[nitro-mcp-toolkit] \`auth.header\` is not a valid header name: ${options.header}`,
    )
  }

  if (options.resourceMetadataUrl !== undefined) {
    if (options.schemes && !options.schemes.includes('bearer')) {
      throw new Error(
        '[nitro-mcp-toolkit] `auth.resourceMetadataUrl` needs the `bearer` scheme, which `auth.schemes` excludes.',
      )
    }

    if (options.resourceMetadataUrl.includes('"')) {
      throw new Error(
        '[nitro-mcp-toolkit] `auth.resourceMetadataUrl` cannot contain a `"` — it is carried inside a quoted challenge parameter.',
      )
    }

    // Throws on anything that is not an absolute URL.
    new URL(options.resourceMetadataUrl)
  }
}

/** Constant-time for equal-length inputs; length itself is not treated as secret. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return mismatch === 0
}

function extractCredential(
  event: H3Event,
  schemes: McpAuthScheme[],
  header: string,
): McpAuthCredential | undefined {
  if (schemes.includes('bearer')) {
    const authorization = event.req.headers.get('authorization')
    const match = authorization ? /^Bearer\s+(.+)$/i.exec(authorization) : null
    if (match) return { scheme: 'bearer', token: match[1].trim() }
  }

  if (schemes.includes('api-key')) {
    const value = event.req.headers.get(header)
    if (value) return { scheme: 'api-key', token: value.trim() }
  }

  return undefined
}

function challenge(resourceMetadataUrl: string | undefined): string {
  return resourceMetadataUrl
    ? `Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}"`
    : 'Bearer realm="mcp"'
}

/**
 * A `401`, with the spec-correct `WWW-Authenticate` challenge — never a
 * JSON-RPC body, since the request never reached the protocol layer.
 */
function unauthorized(resourceMetadataUrl: string | undefined): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'www-authenticate': challenge(resourceMetadataUrl) },
  })
}

/**
 * Build the gate every request passes through before the SDK ever sees it.
 * Validates the config eagerly, so a typo throws when the handler is
 * created, not on the first request.
 *
 * @internal
 */
export function buildAuthGate(options: McpAuthOptions | undefined): McpAuthGate | undefined {
  if (!options) return undefined

  assertValid(options)

  const schemes = options.schemes ?? ['bearer', 'api-key']
  const header = (options.header ?? 'x-api-key').toLowerCase()
  const tokens = options.tokens?.map((token) => token.trim())

  return async (event) => {
    const credential = extractCredential(event, schemes, header)

    if (credential && credential.token.length <= MAX_CREDENTIAL_LENGTH) {
      const listed = tokens?.some((token) => safeEqual(token, credential.token)) ?? false
      if (listed || (options.validate && (await options.validate(credential, event)))) {
        return undefined
      }
    }

    return unauthorized(options.resourceMetadataUrl)
  }
}
