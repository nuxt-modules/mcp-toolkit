import type { McpDefinition, McpDefinitionSummary, McpIdentity, McpResource } from './definition.ts'

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
 * The `_meta` a definition advertises, so a client can tell apart what a name
 * alone does not. Absent when there is nothing to say.
 *
 * @internal
 */
export function resolveMeta(
  group: string | undefined,
  tags: string[] | undefined,
): Record<string, unknown> | undefined {
  if (!group && !tags?.length) return undefined

  return { ...(group ? { group } : {}), ...(tags?.length ? { tags } : {}) }
}

function isResource(definition: McpDefinition): definition is McpResource {
  return definition.kind === 'resource'
}

/**
 * Flatten registrations into what a handler advertises about itself.
 *
 * @internal
 */
export function summarize(registrations: readonly McpRegistration[]): McpDefinitionSummary[] {
  return registrations.map(({ definition, identity }) => ({
    kind: definition.kind,
    name: identity.name,
    ...(identity.title ? { title: identity.title } : {}),
    ...(definition.description ? { description: definition.description } : {}),
    ...(identity.group ? { group: identity.group } : {}),
    ...(definition.tags?.length ? { tags: [...definition.tags] } : {}),
    ...(isResource(definition) ? { uri: definition.uri } : {}),
    ...(definition.source ? { file: definition.source.file } : {}),
  }))
}

/**
 * Check a definition set before it ever serves a request, and pair each
 * definition with the identity it registers under.
 *
 * Nothing downstream rejects a duplicate name: the second entry would simply
 * shadow the first, and the tool nobody can call would look like a client bug.
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

    registrations.push({
      definition,
      identity: { name, title, group: definition.group ?? definition.source?.group },
    })
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

  const resources = definitions.filter(isResource)

  for (const uri of duplicates(resources.map((resource) => resource.uri))) {
    problems.push(`Resources must answer distinct URIs, but ${JSON.stringify(uri)} is used twice.`)
  }

  if (problems.length > 0) {
    fail(problems)
  }

  return registrations
}
