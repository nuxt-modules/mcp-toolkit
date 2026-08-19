# Nitro MCP Toolkit

Build a [Model Context Protocol](https://modelcontextprotocol.io) server inside any [Nitro](https://nitro.build) v3 app.

[h3-mcp](https://mcp.h3.dev) owns the protocol. This package is discovery and DX on top: drop a file under `server/mcp/{tools,resources,prompts}` and it is served.

Targets protocol revision **2026-07-28** and falls back to the 2025 revisions automatically, so one endpoint serves both generations of clients.

> [!NOTE]
> Early development, built wave by wave. Everything documented here is tested, but the API can still move between releases.

## Install

```bash
npm install nitro-mcp-toolkit zod
```

`h3` is a peer. `nitro` is only needed if you install the module (`nitro-mcp-toolkit/module`); `createMcpHandler` runs on h3 alone.

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
  era: 'dual', // or 'modern', for a 2026-07-28-only endpoint
  origin: { allow: ['https://app.example.com'] }, // browser clients, see below
  auth: { tokens: [process.env.MCP_TOKEN!] }, // require a credential, see Authentication below
})
```

These cross into generated code, so they are data only. A server that needs `validate` or `onListen` mounts the handler by hand instead — see [Wiring it by hand](#wiring-it-by-hand).

### Browser clients

MCP clients send no `Origin` header, so this decides one thing only: which **web pages** may drive your server. A page the app serves to itself over a loopback host is accepted, which is why a browser tool works in development with nothing to configure, and every other origin is refused — that is what stops a page on some other host from driving a server bound to localhost.

Deployed elsewhere, that page's origin has to be named:

```ts
mcp({ origin: { allow: ['https://app.example.com'] } })
```

An origin is matched exactly, scheme and port included. Pass `origin: false` to drop the check — reasonable for a public endpoint where a token, not the origin, is the boundary.

The loopback condition is the load-bearing part of the default: `Origin` can only be compared against the request's own origin when the host is a loopback address. Everywhere else the host comes from a header the caller sets, and DNS rebinding — the attack this check exists to stop — sends the attacker's hostname in both, so a bare same-origin comparison always agrees with itself.

### Limit available tools

Clients can send `X-MCP-Tools` with a comma-separated list of tool names to expose only those tools. Names must match `tools/list`. Unknown names return HTTP 400. Omit the header to keep the full catalog. Resources and prompts are unaffected.

```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://example.com/mcp",
      "headers": {
        "X-MCP-Tools": "search-icons, get-component"
      }
    }
  }
}
```

`handler.definitions` is the full catalog either way — filter that array yourself for a JSON route; the header only changes what this request's MCP server registers.

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
| a full `CallToolResult`     | used as-is                    |
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

A return that doesn't actually satisfy a declared `outputSchema` is a protocol error (`-32602`), not an `isError` result — the engine validates the advertised shape after the handler returns.

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

Resources and prompts don't have an `isError` field on the wire, so a thrown error there surfaces as a JSON-RPC-level error instead — the client's `readResource`/`getPrompt` call rejects rather than returning a result.

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

Pass a `uriTemplate` for a family of URIs. `list` powers discovery and `complete` powers argument autocompletion in clients.

```ts
import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  uriTemplate: 'docs://{slug}',
  list: () => pages.map((slug) => ({ name: slug, uri: `docs://${slug}` })),
  complete: (ctx) => ({
    values: pages.filter((page) => page.startsWith(ctx.argument.value)),
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
  inputSchema: z.object({
    text: z.string(),
    // Prompt arguments arrive as strings on the wire.
    words: z.coerce.number().default(50),
  }),
  handler: ({ text, words }) => `Summarize the following in ${words} words:\n\n${text}`,
})
```

## The event

Every handler receives the `H3Event` serving the request as its last argument — the only argument when there is no input schema. It is the same event driving the rest of Nitro: headers, cookies, `waitUntil`, `event.context` as populated by your own middleware.

```ts
handler: (event) => {
  const token = event.req.headers.get('authorization')
  return { path: event.url.pathname, era: event.context.mcp.era }
}
```

Everything specific to this call — as opposed to the request in general — sits under `event.context.mcp`:

| Field            | What it is                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `signal`         | Aborts when the client cancels                                                                    |
| `era`            | `'modern'` or `'legacy'`, the revision this client negotiated                                     |
| `notify`         | Push a list-changed or resource-updated event — see [Change notifications](#change-notifications) |
| `inputResponses` | Answers the client echoed back on a multi-round-trip retry                                        |
| `requestState`   | Opaque server state the client echoed back — treat it as attacker-controlled                      |

`H3Event['context']['mcp']` is optional in general — most events on the app never go through this package. A `defineMcpTool`/`defineMcpResource`/`defineMcpPrompt` handler's own `event` is typed narrower (`McpEvent`, exported for when you need to name it), so `event.context.mcp` needs no `!` or guard there. Reach for one only where the event is a plain `H3Event` instead — [wiring a route by hand](#wiring-it-by-hand) before the handler runs, or a route unrelated to this endpoint.

### Multi-round-trip

A tool can pause mid-call and ask the client for something — confirmation, a sample, a root listing — then pick up where it left off once the answer arrives. `inputRequired` and `mcpElicit` build that exchange; `getInputResponses` / `getMissingInputs` read it back. `getElicitedContent` is the shortcut for an idempotent form (it collapses missing, declined, and cancelled into `undefined`, so a refusal looks like a first visit and is asked again).

```ts
import { defineMcpTool, getInputResponses, inputRequired, mcpElicit } from 'nitro-mcp-toolkit'
import { z } from 'zod'

const requests = {
  confirm: mcpElicit({
    message: 'Delete this?',
    requestedSchema: {
      type: 'object',
      properties: { confirm: { type: 'boolean' } },
      required: ['confirm'],
    },
  }),
}

export default defineMcpTool({
  inputSchema: z.object({ id: z.string() }),
  handler: ({ id }, event) => {
    const answer = getInputResponses(event, requests).confirm
    if (answer === undefined) {
      return inputRequired(event, { inputRequests: requests })
    }
    if (answer.action !== 'accept' || !answer.content?.confirm) {
      return 'cancelled'
    }

    return db.delete(id)
  },
})
```

`canRequestInput` / `getSupportedInputs` are the same capability check `inputRequired` runs, without the throw — use them when the handler can degrade instead of erroring. `event.context.mcp.inputResponses` and `requestState` are the raw fields for anything the helpers don't cover.

`requestState` is opaque, server-minted state the client echoes back verbatim — treat it as attacker-controlled input on the way back in. `defineRequestState` is an HMAC-SHA256 codec for that: seal on the way out, open on the way back, and reject anything that fails verification.

## Change notifications

`event.context.mcp.notify` tells clients a list changed or a resource updated, from inside a handler on the same server:

```ts
handler: ({ id }, event) => {
  db.delete(id)
  event.context.mcp.notify.resourcesChanged()
  return 'done'
}
```

`notify.toolsChanged()`, `promptsChanged()` and `resourcesChanged()` take no arguments; `resourceUpdated(uri)` names the one that changed. From outside a handler — a cron job, a webhook route — there is no `event.context.mcp` to reach: that event never passed through this MCP server, so it was never attached one. Import the handler directly instead; it carries the same methods as `handler.notify`.

```ts
// server/routes/webhook.ts
import mcp from '#mcp/mcp/handler'

export default (event) => {
  mcp.notify.resourcesChanged()
}
```

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

The handler also exposes a web-standard `fetch`, so it mounts anywhere else too — `new H3().all('/mcp', handler)`, or straight onto any fetch-native runtime. Pass `{ extensionPlugins }` as the second argument to install [h3-mcp](https://mcp.h3.dev) extensions such as tasks or MCP Apps.

## Authentication

Off by default — many MCP endpoints sit behind a gateway that already authenticates. Turn it on and every request to the route, `POST`, `GET` and `DELETE` alike, must present a credential:

```ts
createMcpHandler({
  name: 'my-server',
  auth: { tokens: [process.env.MCP_TOKEN!] },
  tools: [greet],
})
```

With no `schemes` given, both are accepted: `Authorization: Bearer <token>` and `x-api-key: <token>`. Pass `schemes: ['api-key']` (with an optional `header`, default `x-api-key`) to accept only one form.

For dynamic credentials — a JWT, a per-tenant key, a lookup — validate yourself. The callback receives the parsed credential and the event, and returns a boolean; stashing whatever you resolve directly on `event.context` is how it reaches your handlers, since auth runs before any of them:

```ts
createMcpHandler({
  auth: {
    schemes: ['bearer'],
    validate: async (auth, event) => {
      const claims = await verifyJwt(auth.token)
      if (!claims) return false
      event.context.tenant = claims.tenant
      return true
    },
  },
})
```

Enabling `auth` requires at least one of `tokens` or `validate` — a config with neither throws when the handler is built, rather than accepting everything. A missing or invalid credential gets a `401` with a `www-authenticate` header and no JSON-RPC body, since the request never reached the protocol layer.

`auth` answers "may this caller talk to this endpoint" — nothing more. A valid credential still reaches every tool and resource the server declares; per-operation authorization belongs in your `validate` callback (check scopes there) or in your handlers.

### Zero-config: `mcp()`

`mcp()`'s options cross into generated code as JSON, so its `auth` is the JSON-serializable subset of what `createMcpHandler` accepts above — a static `tokens` list, no `validate` callback. Omit it and that server stays open, exactly like every other `mcp()` option:

```ts
// nitro.config.ts
export default defineConfig({
  modules: [
    mcp({ name: 'my-server', version: '1.0.0' }), // no `auth`: open
    mcp({
      route: '/admin/mcp',
      dir: 'server/mcp-admin',
      auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] },
    }),
  ],
})
```

For a `validate` callback, or anything else that is a live function rather than data, mount `createMcpHandler` yourself in a route file instead — the [Authentication](#authentication) examples above are exactly that.

### Protected resource metadata

If you act as an OAuth 2.1 resource server, point clients at your [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) metadata document — served by your own app, not this package — so a `401` is enough to discover your authorization server:

```ts
auth: {
  schemes: ['bearer'],
  validate: verifyToken,
  resourceMetadataUrl: 'https://example.com/.well-known/oauth-protected-resource',
}
```

Every `401` then answers with `WWW-Authenticate: Bearer realm="mcp", resource_metadata="https://example.com/.well-known/oauth-protected-resource"`.

There is no token format, issuer or audience model here — `validate` is opaque credential comparison, so **audience validation belongs inside it**: verify that the presented token was issued for this server (its `aud` claim, or the equivalent introspection result) before returning `true`, or a token minted for another service is accepted, the confused-deputy attack the spec's authorization security considerations call out.

In tests, pass the credential as `{ headers }` on `createMcpTestClient` rather than forging the transport's `fetch`.

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

Pass `{ era: 'legacy' }` to test the 2025 path. A credential is a header:

```ts
await using client = await createMcpTestClient(handler, {
  headers: { authorization: 'Bearer secret' },
})
```

## Protocol revisions

The handler serves 2026-07-28 and, by default, also answers 2025-era clients (`era: 'dual'`). Pass `era: 'modern'` for a 2026-07-28-only endpoint.

```ts
export default createMcpHandler({ name: 'my-server', version: '1.0.0', era: 'modern' })
```

Note that MCP clients still negotiate the 2025 revision by default, so a client must opt in to the modern path. The toolkit exports `MODERN_PROTOCOL_VERSION` to pin it.

## Runtimes

The runtime is web-standard: h3-mcp owns the protocol, and the toolkit adds no Node built-ins. It runs on Node, Deno, Bun, Vercel, Netlify, and Cloudflare Workers with no `nodejs_compat` flag.

Windows is supported: discovery, the imports generated from the paths it finds, and the dev watcher all speak `/` there, and a CI job keeps it that way.

## License

[MIT](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE)
