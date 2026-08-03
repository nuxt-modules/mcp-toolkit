# Nitro MCP Toolkit

Build a [Model Context Protocol](https://modelcontextprotocol.io) server inside any [Nitro](https://nitro.build) v3 app.

Targets protocol revision **2026-07-28** and falls back to the 2025 revisions automatically, so one endpoint serves both generations of clients.

Built on [`h3-mcp`](https://mcp.h3.dev), which speaks the protocol directly over h3: no Node built-in reaches the bundle, and the toolkit adds file-based discovery, naming conventions and validation on top.

> [!NOTE]
> Early development, built wave by wave. Everything documented here is tested, but the API can still move between releases.

## Install

```bash
npm install nitro-mcp-toolkit@alpha zod
```

Any [Standard Schema](https://standardschema.dev) library works — Zod, Valibot, ArkType. Nothing is auto-imported: every helper is imported explicitly.

## Quick start

Add the module, then write definitions. There is nothing else to wire.

```ts
// nitro.config.ts
import { defineConfig } from 'nitro'
import mcp from 'nitro-mcp-toolkit/module'

export default defineConfig({
  modules: [mcp({ name: 'my-server', version: '1.0.0' })],
})
```

```ts
// server/mcp/tools/greet.ts
import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  description: 'Greet someone by name',
  inputSchema: z.object({ name: z.string() }),
  handler: ({ name }) => `Hello ${name}!`,
})
```

Your server answers MCP at `/mcp`, with one tool named `greet` — after the file it lives in.

## Discovery

Every file under these three directories is registered:

| Directory              | Holds                       |
| ---------------------- | --------------------------- |
| `server/mcp/tools`     | `defineMcpTool` exports     |
| `server/mcp/resources` | `defineMcpResource` exports |
| `server/mcp/prompts`   | `defineMcpPrompt` exports   |

A definition takes its `name` and `title` from its filename — `list-documentation.ts` becomes `list-documentation` and `List Documentation` — so most files never spell either out. Set `name` yourself and it wins, whatever the file is called.

Subdirectories are for your own sanity, not for the client: `tools/admin/purge.ts` is still the tool `purge`, and records `admin` as its group.

In development, adding or deleting a definition file is picked up without a restart.

Every build prints what each endpoint ended up serving, and warns when a route is mounted over a directory that holds nothing — which is what a definition sitting somewhere no `mcp()` looks at looks like from the outside.

### Groups and tags

A definition can carry a `group` and free-form `tags`, on all three kinds:

```ts
export default defineMcpTool({
  group: 'admin', // overrides the group its directory implies
  tags: ['destructive', 'slow'],
  handler: () => purge(),
})
```

Both are advertised in the definition's `_meta`, so a client sees them in `tools/list` and can sort or filter on them. The group defaults to the subdirectory the file sits in, which is why most files only ever set `tags`.

### Options

```ts
mcp({
  route: '/mcp', // where the endpoint is mounted
  dir: 'server/mcp', // where definitions are looked for
  name: 'my-server',
  version: '1.0.0',
  title: 'My Server',
  description: 'What a human reads in a client’s server list',
  icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'] }],
  websiteUrl: 'https://example.com',
  instructions: 'What the model is told about this server as a whole',
  era: 'dual', // or 'modern' / 'legacy' to serve one revision only
  origin: { allow: ['https://app.example.com'] }, // browser clients, see below
})
```

These cross into generated code, so they are data only. A server that needs a callback, such as `onListen` or `auth.validate`, mounts the handler by hand instead — see [Wiring it by hand](#wiring-it-by-hand).

### Browser clients

MCP clients send no `Origin` header, so the origin policy decides one thing only: which **web pages** may drive your server. A page the app serves to itself over a loopback host is accepted, which is why a browser tool works in development with nothing to configure, and every other origin is refused — that is what stops a page on some other host from driving a server bound to localhost.

Deployed elsewhere, that page's origin has to be named:

```ts
mcp({ origin: { allow: ['https://app.example.com'] } })
```

An origin is matched exactly, scheme and port included. Pass `origin: false` to drop the check — reasonable for a public endpoint where a token, not the origin, is the boundary.

The loopback condition is the load-bearing part of the default, and worth knowing if you write your own `validate`: `Origin` can only be compared against the request's own origin when the host is a loopback address. Everywhere else the host comes from a header the caller sets, and DNS rebinding — the attack this check exists to stop — sends the attacker's hostname in both, so the two always agree.

### More than one server

Install the module again. Nitro only dedupes modules given as a path, so each call is its own server, with its own definitions.

```ts
export default defineConfig({
  modules: [
    mcp({ name: 'my-server', version: '1.0.0' }),
    mcp({ route: '/admin/mcp', dir: 'server/mcp-admin', name: 'my-admin', version: '1.0.0' }),
  ],
})
```

A server serves exactly what sits under its `dir`, so the admin tools above are not filtered out of `/mcp` — they were never part of it, and no definition can belong to a server it does not sit under. To serve one definition from two endpoints, point both instances at the same `dir`, or [wire a route by hand](#wiring-it-by-hand) and import the definitions you want.

### Listing what a server serves

A handler exposes the set it registered as plain JSON — the same set every client sees. Each server is generated under a module id named after its route, so any route can import it:

```ts
// server/routes/catalog.ts
import mcp from '#mcp/mcp/handler' // `/admin/mcp` is `#mcp/admin-mcp/handler`

export default defineHandler(() =>
  mcp.definitions.filter((definition) => definition.tags?.includes('public')),
)
```

Each entry carries `kind`, `name`, `title`, `description`, `group`, `tags`, the `uri` of a resource, and the `file` it was discovered in. There is no filtering API on purpose: every field is a plain value, so `Array.filter` covers groups, tags and kinds at once.

Those ids are typed by a declaration the package ships, so there is nothing to configure — and a handler mounted by hand exposes the same `definitions`, read off your own route.

## Tools

A tool is a function a client can call. Arguments are validated against `inputSchema` and typed from it.

```ts
import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
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
| a full `McpCallToolResult`  | used as-is                    |
| `imageResult(base64, mime)` | an image block                |
| `audioResult(base64, mime)` | an audio block                |

### Structured output

Declaring `outputSchema` narrows the handler's return type **and** routes a plain return into `structuredContent`, so the schema you advertise is the one you satisfy.

```ts
export default defineMcpTool({
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
  uri: 'docs://changelog',
  mimeType: 'text/markdown',
  handler: () => readFile('CHANGELOG.md', 'utf8'),
})
```

Declare a `uriTemplate` instead of a `uri` for a family of URIs. `list` makes the members discoverable in `resources/list`, and `complete` powers autocompletion as a client types.

```ts
import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  uriTemplate: 'docs://{slug}',
  list: () => pages.map((slug) => ({ name: slug, uri: `docs://${slug}` })),
  complete: ({ argument }) => pages.filter((page) => page.startsWith(argument.value)),
  handler: (uri, { slug }) => renderPage(slug),
})
```

## Prompts

A prompt is a reusable message template. Return a string for a single user message, or a full result for a conversation.

```ts
import { defineMcpPrompt } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpPrompt({
  inputSchema: z.object({
    text: z.string(),
    // Prompt arguments arrive as strings on the wire.
    words: z.coerce.number().default(50),
  }),
  handler: ({ text, words }) => `Summarize the following in ${words} words:\n\n${text}`,
})
```

Declare `arguments` instead of an `inputSchema` when a prompt should offer completions. The wire only carries strings, so that is what the handler receives — untouched by a schema.

```ts
export default defineMcpPrompt({
  arguments: [
    {
      name: 'fruit',
      required: true,
      complete: ({ argument }) => fruits.filter((fruit) => fruit.startsWith(argument.value)),
    },
  ],
  handler: ({ fruit }) => `You picked ${fruit}`,
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

| Field    | What it is                                                                         |
| -------- | ---------------------------------------------------------------------------------- |
| `event`  | The `H3Event` serving the request: headers, cookies, `event.context`               |
| `signal` | Aborts when the client cancels                                                     |
| `era`    | `'modern'` or `'legacy'`, the revision this client negotiated                      |
| `mcp`    | The request as the engine sees it: `progress()`, `log()`, `clientInfo`, MRTR state |

There is no ambient state to consult and nothing to await before reading it: the event serving the request _is_ the context. Whatever an auth middleware resolved is on `event.context`, where it put it.

## Wiring it by hand

The module is convenience, never a requirement: `createMcpHandler` returns a value that **is** a Nitro route handler, so a route is all it takes. Reach for this when a server needs something the module's data-only options cannot carry.

```ts
// nitro.config.ts — Nitro only scans for file-based routes once you opt in
export default defineConfig({ serverDir: 'server' })
```

```ts
// server/routes/mcp.ts
import { createMcpHandler, defineMcpTool } from 'nitro-mcp-toolkit'

const greet = defineMcpTool({ name: 'greet', handler: () => 'Hello!' })

export default createMcpHandler({ name: 'my-server', version: '1.0.0', tools: [greet] })
```

Handwritten definitions name themselves, since no filename is there to do it.

The handler also exposes a web-standard `fetch`, so it mounts anywhere else too — `new H3().all('/mcp', handler)`, or straight onto any fetch-native runtime.

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

Pass `{ era: 'legacy' }` to test the 2025 path, or `{ headers }` for an endpoint that gates on a token.

## Protocol revisions

The handler serves both revisions and dispatches per request. Pass `era: 'modern'` for a 2026-07-28-only endpoint, or `era: 'legacy'` to serve the 2025 era alone.

```ts
export default createMcpHandler({ name: 'my-server', version: '1.0.0', era: 'modern' })
```

Note that MCP clients still negotiate the 2025 revision by default, so a client must opt in to the modern path. The toolkit exports `MODERN_PROTOCOL_VERSION` to pin it.

## Runtimes

Neither the runtime nor the engine under it imports a single Node built-in — whatever a bundle ends up needing comes from the preset you build for, not from here. So the server runs anywhere `fetch` does: Node, Deno, Bun, Cloudflare Workers, Vercel, Netlify, with no compatibility flag to turn on. The request context is the `H3Event`, not ambient state, which is what spares it `node:async_hooks`.

Built for `cloudflare_module`, an app with five tools, four resources and two prompts comes out at 61.9 kB gzip with not one `node:` import in the worker.

Only the module is build-time, and only because a file cannot be discovered where there is no filesystem: it reads the directory while Nitro builds and generates the imports. Nothing of it ships.

Windows is supported: discovery, the imports generated from the paths it finds, and the dev watcher all speak `/` there, and a CI job keeps it that way.

## License

[MIT](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE)
