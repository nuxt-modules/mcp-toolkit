import { enrichNameTitle } from './definitions/utils'

type NamedTool = {
  name?: string
  title?: string
  _meta?: Record<string, unknown>
}

/**
 * Parse the `X-MCP-Tools` header. `undefined` means the header is absent
 * (no filter). An empty or whitespace-only value is an empty allowlist.
 */
export function parseMcpToolsHeader(value: string | undefined): Set<string> | undefined {
  if (value === undefined) {
    return undefined
  }
  return new Set(value.split(',').map(name => name.trim()).filter(Boolean))
}

/**
 * Keep tools whose resolved `tools/list` name is in `requested`.
 * Names are resolved the same way as registration (`enrichNameTitle`),
 * including filename-generated kebab-case.
 */
export function filterToolsByRequestedNames<T extends NamedTool>(
  tools: readonly T[],
  requested: Set<string>,
): { tools: T[], unknownNames: string[] } {
  const resolved = tools.map((tool) => {
    const { name } = enrichNameTitle({
      name: tool.name,
      title: tool.title,
      _meta: tool._meta,
      type: 'tool',
    })
    return { tool, name }
  })
  const known = new Set(resolved.map(entry => entry.name))
  const unknownNames = [...requested].filter(name => !known.has(name))
  return {
    tools: resolved.filter(entry => requested.has(entry.name)).map(entry => entry.tool),
    unknownNames,
  }
}
