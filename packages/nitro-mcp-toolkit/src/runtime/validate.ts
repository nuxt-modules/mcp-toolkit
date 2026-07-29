import type { McpDefinition, McpResource } from './definition.ts'

const KINDS = { tool: 'Tools', resource: 'Resources', prompt: 'Prompts' } as const

function fail(problems: string[]): never {
  const detail = problems.map((problem) => `  - ${problem}`).join('\n')
  throw new Error(`[nitro-mcp-toolkit] Invalid MCP definitions:\n${detail}`)
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value)
    }
    seen.add(value)
  }

  return [...repeated]
}

/**
 * Check a definition set before it ever serves a request.
 *
 * The SDK registers definitions per request, so a clash would otherwise first
 * surface as an HTTP 500 on the first call, with the real cause nowhere in the
 * message the client receives.
 *
 * @internal
 */
export function assertDefinitions(definitions: readonly McpDefinition[]): void {
  const problems: string[] = []

  for (const definition of definitions) {
    if (typeof definition.name !== 'string' || definition.name.trim() === '') {
      problems.push(`A ${definition.kind} was defined without a name.`)
    }
  }

  for (const [kind, label] of Object.entries(KINDS)) {
    const named = definitions.filter((definition) => definition.kind === kind)

    for (const name of duplicates(named.map((definition) => definition.name))) {
      problems.push(`${label} must have unique names, but ${JSON.stringify(name)} is used twice.`)
    }
  }

  const uris = definitions
    .filter((definition): definition is McpResource => definition.kind === 'resource')
    .map((resource) => resource.uri)

  for (const uri of duplicates(uris)) {
    problems.push(`Resources must answer distinct URIs, but ${JSON.stringify(uri)} is used twice.`)
  }

  if (problems.length > 0) {
    fail(problems)
  }
}
