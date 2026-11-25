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
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

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
import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

const bmiOutput = z.object({
  bmi: z.number(),
  category: z.enum(['underweight', 'normal', 'overweight', 'obese']),
})

export default defineMcpTool({
  description: 'Calculate Body Mass Index from height and weight',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: z.object({
    heightM: z.number().positive().describe('Height in meters'),
    weightKg: z.number().positive().describe('Weight in kilograms'),
  }),
  outputSchema: bmiOutput,
  handler: ({ heightM, weightKg }): z.input<typeof bmiOutput> => {
    const bmi = Number((weightKg / (heightM * heightM)).toFixed(2))
    const category = bmi < 18.5 ? 'underweight'
      : bmi < 25 ? 'normal'
        : bmi < 30 ? 'overweight' : 'obese'

    return { bmi, category }
  },
})
```

An output schema narrows the return type and validates the result. Use `toolResult()` for a full protocol envelope alongside an output schema. Tools also accept ordinary values, `imageResult`, and `audioResult`. Thrown application errors become `isError` results.

Resources use `uri` or `uriTemplate`; prompts return a string or an explicit `messages` result. Read current identity, cancellation, logging, and notifications from the callback's event.

Tools without arguments omit `inputSchema`; no empty schema or unused Zod import is needed. A tool with an output schema still imports its schema library. Set `autoImports: false` for explicit imports from `@nuxtjs/mcp-toolkit/server`.

## Cache application data

For Nuxt 4 / Nitro 2 on Node, cache the application function outside the handler. Keep the output schema on the tool:

```ts
import { defineCachedFunction } from 'nitropack/runtime'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { z } from 'zod'

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const getProduct = defineCachedFunction(async (id: string) => {
  const response = await fetch(
    `https://api.example.com/products/${encodeURIComponent(id)}`,
  )
  if (!response.ok) throw new Error('The product service is unavailable.')
  return productSchema.parse(await response.json())
}, {
  name: 'mcp-public-product',
  maxAge: 600,
  swr: false,
})

export default defineMcpTool({
  description: 'Get a public product',
  annotations: { readOnlyHint: true, openWorldHint: true },
  inputSchema: z.object({ id: z.string().min(1) }),
  outputSchema: productSchema,
  handler: ({ id }) => getProduct(id),
})
```

Replace the example upstream URL. `maxAge` is seconds; the default cache key hashes the function arguments. Set `swr` explicitly. For private data, authorize each call and include the verified user/tenant identity in those arguments.

Standalone Nitro 3 uses `nitro/cache` for the cached function and `nitro-mcp-toolkit` for tool helpers. Storage and worker lifecycle setup depend on the installed Nitro version; [the caching guide](https://github.com/nuxt-modules/mcp-toolkit/blob/v1/apps/docs/content/2.tools/3.errors-caching.md) covers those differences. The old tool-level `cache` option is not part of the current beta API.

## Examples and metadata

Use JSON Schema examples when documenting expected input; Zod 4 emits them from `.meta({ examples })`. MCP `_meta` is a separate extension-metadata field. `_meta.inputExamples` is a custom client convention, not a core MCP feature, and the old typed top-level `inputExamples` helper is not currently available in the beta. See [annotations and metadata](https://github.com/nuxt-modules/mcp-toolkit/blob/v1/apps/docs/content/2.tools/2.annotations.md).

## Named endpoints and layers

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    servers: {
      default: { dir: 'mcp' },
      admin: { dir: 'mcp-admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
    },
  },
})
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
