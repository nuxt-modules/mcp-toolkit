# Tools — 1.0

## Tools

Create one default-exported definition per file in `server/mcp/tools`:

```ts
import { z } from 'zod'

export default defineMcpTool({
  description: 'Find a project',
  inputSchema: z.object({ id: z.string() }),
  handler: ({ id }, event) => findProject(id, event.context.oauth?.sub),
})
```

Names and titles come from filenames unless explicitly provided. Arguments are validated before application code runs. Read the current user from request context; shared definitions must not capture one user's identity.

Return a string, number, boolean, object, array, or full tool result. `imageResult` and `audioResult` create media blocks. A thrown application error becomes an `isError` tool result.

## Schemas and handlers

Use a complete Standard Schema:

```ts
import { z } from 'zod'

export default defineMcpTool({
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  outputSchema: z.object({ total: z.number() }),
  handler: ({ a, b }) => ({ total: a + b }),
})
```

`outputSchema` narrows the callback return type and validates the result. A plain object becomes `structuredContent`. A result that violates the advertised output schema is a protocol error.

For a full protocol envelope alongside an output schema, return `toolResult({ content: [...], structuredContent: ... })`. Plain objects containing fields named `content` or `isError` still mean schema data when an output schema is present.

A tool without an input schema receives the event as its first argument: `handler: event => ...`. With a schema, it receives `(args, event)`.

## Annotations and metadata

```ts
export default defineMcpTool({
  description: 'Read the public project catalog',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: { inputExamples: [{ id: 'demo-project' }] },
  handler: () => readCatalog(),
})
```

Annotations help clients explain an action and decide when to ask their user for confirmation. They do not enforce authorization.

Use `_meta` for extension metadata, `icons` for client-visible icons, and `group` or `tags` for catalog labels. The toolkit owns the metadata values it derives for groups, tags, and scopes.

## Errors and caching

Thrown tool errors become `isError` results so clients can explain a failure. HTTP errors preserve their numeric status and attached data. Return deliberate public messages; internal exception details are visible to the caller.

Resources and prompts have no `isError` result on the wire, so their failures are JSON-RPC errors.

Cache application services with Nitro's `defineCachedFunction` when appropriate, and call the cached service from your definition. Tool definitions no longer accept `cache: '5m'`.

Include every user or tenant boundary in a private cache key. Cache shared public data separately from authenticated results. `outputSchema` validation failures are protocol errors, rather than successful cached responses.
