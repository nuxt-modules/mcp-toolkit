# Resources — 1.0

## Publish one concrete URI

```ts [server/mcp/resources/help.ts]
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpResource({
  uri: 'docs://help',
  description: 'How to use this MCP server',
  mimeType: 'text/plain',
  handler: () => 'Use the greet tool to greet someone by name.',
})
```

This publishes `docs://help` under the name `help`. A URI identifies content in your application; it does not need to be a public HTTP URL or a filesystem path.

`name` and `title` are derived from the filename when omitted. Set them explicitly when a different spelling is useful. Duplicate concrete URIs and advertised names within one endpoint fail validation.

## Return explicit content

```ts [server/mcp/resources/release-notes.ts]
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpResource({
  uri: 'docs://release-notes',
  description: 'Release notes for this application',
  mimeType: 'text/markdown',
  handler: uri => ({
    contents: [{
      uri: uri.href,
      mimeType: 'text/markdown',
      text: '# Release notes\n\nThe MCP endpoint supports typed results.',
    }],
  }),
})
```

The contents URI is the requested address. Keep content MIME metadata accurate so clients can render it appropriately. See [file operations](https://mcp-toolkit.nuxt.dev/examples/file-operations) for a real file-backed resource.

## Use request context

A static handler receives `(uri, event)`. Read verified user or tenant identity from the current event, and apply it to every private data query. A shared definition must not capture a user's identity at initialization.

See [templates](https://mcp-toolkit.nuxt.dev/resources/templates-and-handlers) when the URI contains variables, or [metadata and errors](https://mcp-toolkit.nuxt.dev/resources/content-metadata-errors) for binary content and client cache hints.

## Declare a URI template

```ts [server/mcp/resources/guides.ts]
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'
import { z } from 'zod'

const guides: Record<string, string> = {
  installation: 'Install the module and add it to nuxt.config.ts.',
  caching: 'Cache reusable application work with Nitro cached functions.',
}

export default defineMcpResource({
  uriTemplate: 'docs://guides/{slug}',
  description: 'Read an application guide',
  mimeType: 'text/plain',
  list: () => Object.keys(guides).map(slug => ({
    name: slug,
    uri: `docs://guides/${slug}`,
  })),
  complete: ({ argument }) => ({
    values: Object.keys(guides).filter(slug => slug.startsWith(argument.value)),
  }),
  handler: (_uri, variables) => {
    const { slug } = z.object({ slug: z.string().min(1) }).parse(variables)
    const guide = guides[slug]
    if (guide === undefined) throw new Error('Guide not found')
    return guide
  },
})
```

The toolkit compiles `uriTemplate` through the shared engine's template helper. Do not construct an SDK `ResourceTemplate` or use the old nested resource metadata contract.

## Read callback arguments

| Callback | Arguments | Return |
| --- | --- | --- |
| `handler` | `(uri, variables, event)` | Text or `{ contents }` |
| `list` | `event` | Array of resource descriptors |
| `complete` | `({ argument, arguments }, event)` | `{ values, total?, hasMore? }` |

`argument` contains the variable name and current prefix. `arguments` contains any already-resolved values sent by the client. Use the current event when suggestions or enumeration depend on verified identity.

`list` returns the descriptor array directly, rather than a nested `{ resources }` object. Listing a template and reading a member are separate operations. Validate application-specific identifiers before accessing a database or storage.

## Protect every application callback

A resource's `scopes` gate reads, template enumeration, and completion. Missing scopes prevent application callbacks from running. Unauthorized template enumeration fails `resources/list`; the toolkit does not quietly return a partial list. Static definition metadata remains visible after endpoint authentication.

See [OAuth scopes](https://mcp-toolkit.nuxt.dev/getting-started/oauth#require-scopes-on-definitions) and [resource organization](https://mcp-toolkit.nuxt.dev/resources/organization).

## Put metadata on the definition

`description`, `mimeType`, `icons`, `group`, `tags`, `scopes`, and `_meta` are top-level properties. MCP `_meta` carries extension metadata; use typed toolkit properties for groups, tags, and scopes.

## Return binary contents

```ts [server/mcp/resources/pixel.ts]
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpResource({
  uri: 'images://pixel',
  description: 'A one-pixel PNG example',
  mimeType: 'image/png',
  handler: uri => ({
    contents: [{
      uri: uri.href,
      mimeType: 'image/png',
      blob: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    }],
  }),
})
```

Use `text` for text contents and base64 `blob` for binary contents. Tool media helpers are for tool content blocks; resource contents use the resource result shape.

## Advertise client caching deliberately

```ts [server/mcp/resources/cached-help.ts]
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpResource({
  uri: 'docs://help',
  description: 'How to use this MCP server',
  mimeType: 'text/plain',
  cache: { ttlMs: 60_000, cacheScope: 'public' },
  handler: () => 'Use the greet tool to greet someone by name.',
})
```

Here `cache` is the shared engine's client cache-hint object. It uses milliseconds and does not memoize the handler. Public hints are appropriate only for content that can be reused across authorization contexts. Legacy clients may not understand these modern hints.

To cache server work, use Nitro cached application functions with keys that include verified identity for private data. See [server caching](https://mcp-toolkit.nuxt.dev/tools/errors-caching).

## Report read failures

Throw when a read cannot be completed. Resources have no tool-style `isError` result; returning error text inside `contents` would present it as content. Keep public error messages appropriate for callers and record private diagnostics in application logs.
