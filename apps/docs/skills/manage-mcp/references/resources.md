# Resources — 1.0

## Resources

```ts
export default defineMcpResource({
  uri: 'docs://readme',
  mimeType: 'text/markdown',
  handler: () => '# Project documentation',
})
```

Create the file under `server/mcp/resources`. A string is wrapped as a resource contents result. Return `{ contents: [...] }` for multiple contents, binary data, or content-specific metadata.

Use `uriTemplate` for a family of addresses. Resources can carry `scopes`; unauthorized reads and application enumeration callbacks fail before application code runs.

## Resource templates

```ts
export default defineMcpResource({
  uriTemplate: 'docs://{slug}',
  list: () => pages.map(slug => ({ name: slug, uri: `docs://${slug}` })),
  complete: context => ({ values: pages.filter(slug => slug.startsWith(context.argument.value)) }),
  handler: (uri, { slug }, event) => renderPage(slug, event.context.oauth?.sub),
})
```

Static handlers receive `(uri, event)`. Template handlers receive `(uri, variables, event)`. `list` returns resource descriptors directly, and `complete` returns completion values.

Use `uriTemplate`, rather than constructing an SDK `ResourceTemplate`. The engine owns RFC 6570 matching. Validate application paths and enforce row or tenant ownership before reading data.

## Resource content and metadata

`mimeType`, `icons`, and `_meta` live directly on a resource definition. `cache` contains protocol cache hints, rather than a server-side cache duration string.

```ts
export default defineMcpResource({
  uri: 'docs://guide',
  mimeType: 'text/markdown',
  handler: uri => ({
    contents: [{ uri: uri.href, text: '# Guide', mimeType: 'text/markdown' }],
  }),
})
```

For binary resources, return a `contents` entry with `blob` containing base64 data. A thrown error rejects `resources/read` with a JSON-RPC error. Return public error messages without private datastore details.
