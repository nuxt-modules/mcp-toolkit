# Nuxt MCP Toolkit

Build [Model Context Protocol](https://modelcontextprotocol.io) servers in Nuxt. The module adds file discovery, layers, auto-imports, and development tooling to the shared `nitro-mcp-toolkit` engine.

Requires Nuxt 4.6 or later. The default endpoint supports the modern `2026-07-28` protocol and 2025 Streamable HTTP clients.

## Install

```sh
pnpm add @nuxtjs/mcp-toolkit zod
```

```ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: { name: 'My server', version: '1.0.0' },
})
```

```ts
// server/mcp/tools/greet.ts
import { z } from 'zod'

export default defineMcpTool({
  description: 'Greet someone by name',
  inputSchema: z.object({ name: z.string() }),
  handler: ({ name }) => `Hello ${name}!`,
})
```

Connect a client to `/mcp`. Tools, resources, and prompts take their names and titles from their filenames. Adding or removing definition files triggers a rebuild in development.

## Shared definitions

The same definitions work in Nuxt and standalone Nitro. Schemas implement Standard Schema; Zod, Valibot, and ArkType are supported. Callbacks receive `(args, event)`, or just `event` without an input schema.

```ts
export default defineMcpTool({
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.object({ total: z.number() }),
  handler: ({ a, b }) => ({ total: a + b }),
})
```

An output schema narrows the return type and validates the result. Use `toolResult()` for a full protocol envelope alongside an output schema. Tools also accept ordinary values, `imageResult`, and `audioResult`. Thrown application errors become `isError` results.

Resources use `uri` or `uriTemplate`; prompts return a string or an explicit `messages` result. Read current identity, cancellation, logging, and notifications from the callback's event.

Set `autoImports: false` for explicit imports from `@nuxtjs/mcp-toolkit/server`.

## Named endpoints and layers

```ts
mcp: {
  servers: {
    default: { dir: 'mcp' },
    admin: { dir: 'mcp-admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
  },
}
```

This mounts `/mcp` and `/mcp/admin`. Each server scans its own directories. `dir` is relative to each Nuxt layer's server directory; the main app overrides the same relative file in an extended layer. A directory array gives earlier roots priority.

Use `oauth` for JWT resource-server verification, and `scopes` on definitions for operation-level checks. Scopes gate invocation while static metadata remains listed. Put sensitive catalogs on separately authenticated endpoints. Clients can request a tool subset through `X-MCP-Tools`.

Import generated servers from `nitro-mcp-toolkit/servers` to read `handler.definitions` or send notifications. Manually compose routes with the Nuxt `createMcpHandler` helper when live callbacks are needed.

## Beta scope

Built-in MCP Apps are deferred. Vue files under `app/mcp` do not generate tools or UI resources; move their server-side logic into ordinary tool definitions.

## Client compatibility and testing

`era: 'dual'` serves modern and legacy clients. Keep required values available as ordinary tool arguments when using modern input-required interactions, so older clients have a usable path. `session: true` enables legacy sessions; durable application state belongs in application storage keyed by verified identity.

`nitro-mcp-toolkit/testing` connects a real MCP client in memory. Test both eras, authentication, and the production Nuxt build. The module also retains the DevTools Inspector launcher, installation buttons and badges, and optional `llms.txt` discovery.

## Migrating to 1.0

1.0 replaces the SDK-based Nuxt runtime. Code Mode, direct SDK-server access, global registry-query helpers, and ambient session/elicitation/logger wrappers are removed. Use complete schemas, explicit request events, configured servers, application storage, and the engine's continuation helpers.

Read the [migration guide](https://github.com/nuxt-modules/mcp-toolkit/blob/v1/apps/docs/content/1.getting-started/7.beta-migration.md) and [documentation](https://mcp-toolkit.nuxt.dev).

## License

[MIT](../../LICENSE)
