import type { McpHandler } from './handler.ts'

function unavailable(): never {
  throw new Error(
    '[nitro-mcp-toolkit] `nitro-mcp-toolkit/servers` is provided by `mcp()` at build time. ' +
      'Import `createMcpHandler` from `nitro-mcp-toolkit` instead, or add `mcp()` to your Nitro modules.',
  )
}

/** The handler `mcp()` mounts on `/mcp`. Extra instances are generated per app. */
export const mcp: McpHandler = unavailable()
