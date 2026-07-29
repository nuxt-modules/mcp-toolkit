import type { McpDefinition, McpIdentity, McpResource } from './definition.ts'

const KINDS = { tool: 'Tools', resource: 'Resources', prompt: 'Prompts' } as const

/** A definition paired with the name and title it will be registered under. */
export interface McpRegistration {
  definition: McpDefinition
  identity: McpIdentity
}

function fail(problems: string[]): never {
  const detail = problems.map((problem) => `  - ${problem}`).join('\n')
  throw new Error(`[nitro-mcp-toolkit] Invalid MCP definitions:\n${detail}`)
}

/** Where a definition came from, for error messages that must be actionable. */
function locate(definition: McpDefinition): string {
  return definition.source ? ` (${definition.source.file})` : ''
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
 * Resolve the identity a definition registers under: what the definition
 * declares, or what the caller derived from its filename.
 *
 * @internal
 */
export function resolveIdentity(
  kind: McpDefinition['kind'],
  definition: { name?: string; title?: string },
  identity?: McpIdentity,
): McpIdentity {
  const name = identity?.name ?? definition.name

  if (!name) {
    throw new Error(
      `[nitro-mcp-toolkit] This ${kind} has no name. Give it one, or let the module name it ` +
        `from its filename by placing the file under the scanned ${kind}s directory.`,
    )
  }

  return { name, title: identity?.title ?? definition.title }
}

/**
 * Check a definition set before it ever serves a request, and pair each
 * definition with the identity it registers under.
 *
 * The SDK registers definitions per request, so a clash would otherwise first
 * surface as an HTTP 500 on the first call, with the real cause nowhere in the
 * message the client receives.
 *
 * @internal
 */
export function resolveDefinitions(definitions: readonly McpDefinition[]): McpRegistration[] {
  const problems: string[] = []
  const registrations: McpRegistration[] = []

  for (const definition of definitions) {
    const { name, title } = definition

    if (typeof name !== 'string' || name.trim() === '') {
      problems.push(`A ${definition.kind} was defined without a name${locate(definition)}.`)
      continue
    }

    registrations.push({ definition, identity: { name, title } })
  }

  for (const [kind, label] of Object.entries(KINDS)) {
    const named = registrations.filter(({ definition }) => definition.kind === kind)

    for (const name of duplicates(named.map(({ identity }) => identity.name))) {
      const where = named
        .filter(({ identity }) => identity.name === name)
        .map(({ definition }) => definition.source?.file)
        .filter((file) => file !== undefined)

      problems.push(
        `${label} must have unique names, but ${JSON.stringify(name)} is used twice` +
          `${where.length > 0 ? ` (${where.join(', ')})` : ''}.`,
      )
    }
  }

  const resources = definitions.filter(
    (definition): definition is McpResource => definition.kind === 'resource',
  )

  for (const uri of duplicates(resources.map((resource) => resource.uri))) {
    problems.push(`Resources must answer distinct URIs, but ${JSON.stringify(uri)} is used twice.`)
  }

  if (problems.length > 0) {
    fail(problems)
  }

  return registrations
}
