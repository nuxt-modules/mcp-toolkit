type NamedRegistration = {
  definition: { kind: string }
  identity: { name: string }
}

/**
 * Parse the `X-MCP-Tools` header. `undefined` means the header is absent
 * (no filter). An empty or whitespace-only value is an empty allowlist.
 *
 * @internal
 */
export function parseMcpToolsHeader(value: string | null | undefined): Set<string> | undefined {
  if (value == null) {
    return undefined
  }
  return new Set(
    value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  )
}

/**
 * Keep tools whose registered name is in `requested`. Resources and prompts
 * are untouched. Unknown names are reported so the handler can 400 before
 * the protocol layer starts.
 *
 * @internal
 */
export function filterRegistrationsByToolAllowlist<T extends NamedRegistration>(
  registrations: readonly T[],
  requested: Set<string>,
): { registrations: T[]; unknownNames: string[] } {
  const toolNames = new Set(
    registrations
      .filter((entry) => entry.definition.kind === 'tool')
      .map((entry) => entry.identity.name),
  )
  const unknownNames = [...requested].filter((name) => !toolNames.has(name))
  return {
    registrations: registrations.filter(
      (entry) => entry.definition.kind !== 'tool' || requested.has(entry.identity.name),
    ),
    unknownNames,
  }
}

/** @internal */
export function unknownToolsResponse(unknownNames: string[]): Response {
  return new Response(
    JSON.stringify({
      statusCode: 400,
      message: `Unknown MCP tool${unknownNames.length > 1 ? 's' : ''}: ${unknownNames.join(', ')}`,
    }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  )
}
