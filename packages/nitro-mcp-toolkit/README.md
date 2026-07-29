# Nitro MCP Toolkit

Build a [Model Context Protocol](https://modelcontextprotocol.io) server inside any [Nitro](https://nitro.build) v3 app.

Targets protocol revision **2026-07-28** and falls back to the 2025 revisions automatically, so one endpoint serves both generations of clients.

> [!NOTE]
> Early development. The runtime below is stable and tested; file-based discovery and the Nitro module land on `nitro-mcp-toolkit/module` in a later release.

## Install

The toolkit is in alpha, built wave by wave, so it publishes under the `alpha` tag and the API can still move between releases.

```bash
npm install nitro-mcp-toolkit@alpha zod
```

Any [Standard Schema](https://standardschema.dev) library works — Zod, Valibot, ArkType. Nothing is auto-imported: every helper is imported explicitly.

## Quick start

Nitro v3 only scans for file-based routes once you point it at a directory, so opt in first:

```ts
// nitro.config.ts
import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: 'server',
})
```

Then create the route. The value `createMcpHandler` returns **is** a Nitro route handler, so there is nothing to wrap.

```ts
// server/routes/mcp.ts
import { createMcpHandler, defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

const greet = defineMcpTool({
  name: 'greet',
  description: 'Greet someone by name',
  inputSchema: z.object({ name: z.string() }),
  handler: ({ name }) => `Hello ${name}!`,
})

export default createMcpHandler({
  name: 'my-server',
  version: '1.0.0',
  tools: [greet],
})
```

Your server now answers MCP at `/mcp`.

Not using file-based routes? The handler also exposes a web-standard `fetch`, so it mounts anywhere — `new H3().all('/mcp', handler)`, or straight onto any fetch-native runtime.

## Tools

A tool is a function a client can call. Arguments are validated against `inputSchema` and typed from it.

```ts
import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  name: 'search',
  description: 'Search the catalogue',
  annotations: { readOnlyHint: true },
  inputSchema: z.object({
    query: z.string().describe('What to look for'),
    limit: z.number().default(10),
  }),
  handler: async ({ query, limit }) => {
    const rows = await db.search(query, limit)
    return rows // objects and arrays are serialized for you
  },
})
```

### Return values

Return whatever is natural; the toolkit builds the protocol result.

| You return                  | The client receives           |
| --------------------------- | ----------------------------- |
| `string`                    | one text block                |
| `number`, `boolean`         | one text block, stringified   |
| `null`, `undefined`         | no content                    |
| object, array               | one text block of pretty JSON |
| a full `CallToolResult`     | used as-is                    |
| `imageResult(base64, mime)` | an image block                |
| `audioResult(base64, mime)` | an audio block                |

### Structured output

Declaring `outputSchema` narrows the handler's return type **and** routes a plain return into `structuredContent`, so the schema you advertise is the one you satisfy.

```ts
export default defineMcpTool({
  name: 'bmi',
  inputSchema: z.object({ weightKg: z.number(), heightM: z.number() }),
  outputSchema: z.object({ bmi: z.number() }),
  handler: ({ weightKg, heightM }) => ({ bmi: weightKg / heightM ** 2 }),
})
```

### Errors

Throw. A thrown error becomes an `isError` result rather than a transport failure, so the session survives and the model can read what went wrong. `HTTPError` from h3 keeps its status and data.

```ts
import { HTTPError } from 'h3'

handler: async ({ id }) => {
  const order = await db.find(id)
  if (!order) {
    throw new HTTPError({ status: 404, message: `No order ${id}` })
  }
  return order
}
```

## Resources

A resource is data addressed by URI. Return a string for the simple case.

```ts
import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  name: 'changelog',
  uri: 'docs://changelog',
  mimeType: 'text/markdown',
  handler: () => readFile('CHANGELOG.md', 'utf8'),
})
```

Pass a `ResourceTemplate` for a family of URIs. `list` powers discovery and `complete` powers argument autocompletion in clients.

```ts
import { defineMcpResource, ResourceTemplate } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  name: 'doc-page',
  uri: new ResourceTemplate('docs://{slug}', {
    list: () => ({ resources: pages.map((slug) => ({ name: slug, uri: `docs://${slug}` })) }),
    complete: { slug: (value) => pages.filter((page) => page.startsWith(value)) },
  }),
  handler: (uri, { slug }) => renderPage(String(slug)),
})
```

## Prompts

A prompt is a reusable message template. Return a string for a single user message, or a full result for a conversation.

```ts
import { defineMcpPrompt } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpPrompt({
  name: 'summarize',
  inputSchema: z.object({
    text: z.string(),
    // Prompt arguments arrive as strings on the wire.
    words: z.coerce.number().default(50),
  }),
  handler: ({ text, words }) => `Summarize the following in ${words} words:\n\n${text}`,
})
```

## Request context

Every handler receives a context as its last argument — the only argument when there is no input schema.

```ts
handler: (ctx) => {
  const token = ctx.event.req.headers.get('authorization')
  return { path: ctx.event.url.pathname, era: ctx.era }
}
```

| Field    | What it is                                                           |
| -------- | -------------------------------------------------------------------- |
| `event`  | The `H3Event` serving the request: headers, cookies, `event.context` |
| `auth`   | Verified token info, when a verifier is configured                   |
| `signal` | Aborts when the client cancels                                       |
| `era`    | `'modern'` or `'legacy'`, the revision this client negotiated        |
| `mcp`    | The raw SDK context — the escape hatch for anything not wrapped yet  |

## Testing

`nitro-mcp-toolkit/testing` connects a real MCP client to your handler in memory. No port, no build, no HTTP server.

```ts
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'
import { expect, it } from 'vitest'
import handler from '../server/routes/mcp'

it('greets', async () => {
  await using client = await createMcpTestClient(handler)

  const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })

  expect(textOf(result)).toBe('Hello Ada!')
})
```

The client closes itself when it leaves scope, so a failing assertion cannot leak it. `textOf` reads the text out of a tool call, a resource read or a prompt alike, for when the shape of the content blocks is not what you are asserting.

Pass `{ era: 'legacy' }` to test the 2025 path, or `{ auth }` to stand in for a verified token.

## Protocol revisions

The handler serves 2026-07-28 and, by default, falls back to stateless 2025-era serving. Pass `legacy: 'reject'` for a modern-only endpoint.

```ts
export default createMcpHandler({ name: 'my-server', version: '1.0.0', legacy: 'reject' })
```

Note that MCP clients still negotiate the 2025 revision by default, so a client must opt in to the modern path. The toolkit exports `MODERN_PROTOCOL_VERSION` to pin it — the SDK's `LATEST_PROTOCOL_VERSION` names the newest _legacy_ revision, not this one.

## Runtimes

The request context is carried by `AsyncLocalStorage`, so the handler needs `node:async_hooks`: available on Node, Deno and Bun, and on Cloudflare Workers behind the `nodejs_compat` flag.

## License

[MIT](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE)
