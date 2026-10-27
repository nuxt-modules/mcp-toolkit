---
name: manage-mcp
description: Build and troubleshoot MCP servers in Nuxt with the 1.0 shared Nitro engine, typed definitions, authentication and client compatibility tests.
---

# Nuxt MCP Toolkit 1.0

Use this skill to install the module, author tools/resources/prompts, configure endpoints or troubleshoot a Nuxt MCP server. Inspect the installed version first: this skill describes the 1.0 API. For standalone Nitro use `nitro-mcp-toolkit`, whose definitions are the same.

## Start

Install `@nuxtjs/mcp-toolkit` and a Standard Schema library such as Zod. Requires Nuxt 4.6 or later and a Nitro server builder.

```ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: { name: 'My MCP server', version: '1.0.0' },
})
```

Create default exports under `server/mcp/{tools,resources,prompts}`. The endpoint is `/mcp`; names and titles come from filenames. Use explicit imports from `@nuxtjs/mcp-toolkit/server` when auto-imports are disabled.

```ts
import { z } from 'zod'

export default defineMcpTool({
  description: 'Read a project',
  inputSchema: z.object({ id: z.string() }),
  handler: ({ id }, event) => readProjectForUser(id, event.context.oauth?.sub),
})
```

With input, callbacks receive `(args, event)`; without input, they receive `event`. Keep identity in request context, never in a definition shared across users. See [tools](references/tools.md).

## Results, resources, and prompts

Tool values are normalized automatically. `outputSchema` narrows and validates the return type: return schema data directly. Use `toolResult()` for a full protocol envelope alongside an output schema. `imageResult` and `audioResult` produce media blocks. Thrown application errors become `isError` tool results; do not leak private diagnostics.

Resources use `uri` or `uriTemplate`, top-level `mimeType`, and a handler returning text or a contents result. Template callbacks receive `(uri, variables, event)`. `list` returns descriptors directly. See [resources](references/resources.md).

Prompts return a string for one user message, or an explicit `messages` result. Use `arguments` with completion callbacks when dynamic suggestions are needed. See [prompts](references/prompts.md).

## Endpoints and discovery

```ts
mcp: {
  servers: {
    default: { dir: 'mcp' },
    admin: { dir: 'mcp-admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
  },
}
```

This mounts `/mcp` and `/mcp/admin`. Each server scans only its own roots. Paths are relative to every Nuxt layer's server directory. The main app overrides the same relative file in extended layers; earlier configured directory roots take priority. Duplicate advertised names and URIs fail validation.

Use groups and tags for metadata, not authorization. Import generated endpoints from `nitro-mcp-toolkit/servers` and filter `handler.definitions` with ordinary arrays. A non-default export name follows the camel-cased route slug. See [servers](references/handlers.md).

Put endpoint extension plugins in `<dir>/plugins.ts` with `defineMcpPlugins([...])`. Live verifiers and manual collections belong in an ordinary route exporting `createMcpHandler(...)`.

## Authorization and request context

Use endpoint `oauth` for JWT access tokens and protected-resource metadata. Provider connectors under `nitro-mcp-toolkit/oauth/*` return the same options. Custom verifiers use `createMcpOAuth({ verify })`.

Definition `scopes` check verified `event.context.oauth` claims before invocation or application enumeration/completion. Static metadata remains listed. Sensitive catalogs belong behind their own endpoint authentication. Do not trust client role headers or argument user IDs as identity.

Native Nuxt middleware runs before MCP, and its context reaches handlers. `event.context.mcp` provides cancellation, progress, logging, and continuation data. `event.context.mcp.notifier` sends list/resource changes; the engine's `notify` function remains request-scoped. See [middleware](references/middleware.md).

## Client compatibility

Keep `era: 'dual'` to serve modern `2026-07-28` and 2025 Streamable HTTP clients. Do not claim every client supports every feature. Ordinary tools/resources/prompts work across both paths; input-required continuations require modern capabilities. Offer required values as ordinary arguments or clear instructions for older clients.

Use `mcpElicit`, `mcpElicitUrl`, `canRequestInput`, `inputRequired`, `getInputResponses`, `getElicitedContent`, and `getMissingInputs` from the shared engine. Validate resumed input. `defineRequestState` signs state, but does not encrypt it or make it single-use; bind authorization-sensitive state to verified identity.

`session: true` enables legacy protocol sessions. Keep durable application state in storage keyed by verified identity. See [state](references/sessions.md).

## Beta scope

Built-in MCP Apps are deferred. Do not generate `defineMcpApp`, `useMcpApp`, `@nuxtjs/mcp-toolkit/app`, or widget-discovery configuration. Move server-side App logic into regular tools.

## Verify

Use the DevTools MCP Inspector launcher or `nitro-mcp-toolkit/testing`. Test both `era: 'modern'` and `era: 'legacy'`, auth rejection, request context, and server-specific discovery. Build a real Nuxt fixture for integration, layers, streaming, and disconnect checks. See [testing](references/testing.md) and [troubleshooting](references/troubleshooting.md).

## Removed APIs

Do not generate Code Mode, `experimental_codeMode`, `defineMcpHandler`, raw Zod shape schemas, SDK `ResourceTemplate`/`completable`, `useMcpServer`, `getSdkServer`, the ambient session/elicitation/logger wrappers, global `listMcp*`/`getMcp*` queries, or SDK server-creation hooks. Use configured servers, shared definitions, explicit request events, application storage, and engine helpers. The migration guide is `/getting-started/beta-migration`.
