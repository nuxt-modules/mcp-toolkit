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
 * Names in `requested` that are not a registered tool. Resources and prompts
 * do not count: `X-MCP-Tools` is a tool allowlist.
 *
 * @internal
 */
export function unknownToolNames(
  registrations: readonly NamedRegistration[],
  requested: Set<string>,
): string[] {
  const toolNames = new Set(
    registrations
      .filter((entry) => entry.definition.kind === 'tool')
      .map((entry) => entry.identity.name),
  )
  return [...requested].filter((name) => !toolNames.has(name))
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
