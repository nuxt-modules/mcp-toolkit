import { defineHandler } from 'nitro'

interface ToolkitHandlerResult {
  toolkit: string
  status: string
}

/**
 * Placeholder runtime handler mounted by the `nitroMcpToolkit` module.
 *
 * This is intentionally not an MCP server yet — Wave 0 only proves that a
 * `NitroModule` shipped from this package can register a real event handler
 * on a Nitro v3 app. The actual `createMcpHandler` wiring lands in Wave 1.
 *
 * `defineHandler`'s return type (`EventHandlerWithFetch`) isn't part of h3's
 * public type exports in the current SDK line, so TypeScript can't emit a
 * portable declaration referencing it directly. This file is only ever
 * loaded by Nitro via a resolved file path (see `module.ts`), never imported
 * by name, so casting through `unknown` to our own local result type keeps
 * the build clean without depending on h3's unexported internals.
 */
const handler = defineHandler((): ToolkitHandlerResult => ({
  toolkit: 'nitro-mcp-toolkit',
  status: 'ok',
})) as unknown as (event: unknown) => ToolkitHandlerResult

export default handler
