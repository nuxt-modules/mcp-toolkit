import type { McpServer } from '@modelcontextprotocol/server'

/**
 * Where a definition was found, for definitions the module discovered on disk.
 */
export interface McpDefinitionSource {
  /** Path relative to the scanned directory, e.g. `tools/admin/purge.ts`. */
  file: string
  /** Subdirectory the file sits in — `admin` for `tools/admin/purge.ts`. */
  group?: string
}

/**
 * The name and title a definition is registered under. Discovery derives both
 * from the filename, so a file that names itself always wins.
 */
export interface McpIdentity {
  name: string
  title?: string
}

/**
 * A definition as returned by the `defineMcp*` helpers: its schema generics are
 * erased so definitions can be collected in one array, while it keeps enough
 * metadata to be listed without constructing a server.
 */
export interface McpDefinition {
  readonly kind: 'tool' | 'resource' | 'prompt'
  /** Absent when the definition is named by the file it was discovered in. */
  readonly name?: string
  readonly title?: string
  readonly description?: string
  /** Set for discovered definitions; absent for hand-written ones. */
  readonly source?: McpDefinitionSource
  /**
   * Registers this definition on the per-request SDK server instance, under
   * `identity` when the definition does not name itself.
   *
   * @internal
   */
  readonly register: (server: McpServer, identity?: McpIdentity) => void
}

export interface McpTool extends McpDefinition {
  readonly kind: 'tool'
}

export interface McpResource extends McpDefinition {
  readonly kind: 'resource'
  /**
   * The URI clients read, or the template pattern it answers when the
   * definition was given a `ResourceTemplate` — e.g. `docs://{slug}`.
   */
  readonly uri: string
}

export interface McpPrompt extends McpDefinition {
  readonly kind: 'prompt'
}
