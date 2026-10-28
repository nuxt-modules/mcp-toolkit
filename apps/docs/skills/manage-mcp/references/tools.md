# Tool examples — 1.0 beta

These examples use the current shared runtime. Keep full input/output schemas when data benefits from them, and omit `inputSchema` for tools with no arguments. Names and titles come from filenames unless explicitly set.

## Typed BMI calculator

```ts [server/mcp/tools/bmi-calculator.ts]
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

`outputSchema` infers the callback's return shape and validates the result. Return its data directly: the toolkit emits `structuredContent` and a JSON text fallback. A return value that violates the advertised output schema is a protocol error.

## Tool with no arguments

```ts [server/mcp/tools/ping.ts]
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  description: 'Check connectivity',
  handler: () => 'pong',
})
```

Do not add an empty schema or an unused Zod import. A no-input handler receives `event` as its first argument if it needs request context. With an input schema, the signature is `(args, event)`.

## Cached external data with typed output

For Nuxt 4 / Nitro 2 on Node:

```ts [server/mcp/tools/get-product.ts]
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

Replace the example upstream URL. The default key hashes function arguments, so each product ID gets its own entry. `maxAge` is seconds; `swr: false` waits for fresh data after expiry. Parse upstream data before caching it. For standalone Nitro 3, import `defineCachedFunction` from `nitro/cache` and tool helpers from `nitro-mcp-toolkit`.

Cache application values rather than JSON-RPC responses. Authorize private operations on every invocation and include verified user/tenant identity in the cached function arguments. Do not capture identity in a shared closure or put the only access check inside a cached function.

The beta does not accept the old tool-level `cache: '10m'` option. See [errors and caching](https://mcp-toolkit.nuxt.dev/tools/errors-caching) for storage, lifecycle, and client-cache distinctions. Worker lifecycle support must use the host's event/runtime; a toolkit MCP event inside Nitro 2 is not its native H3 v1 cache event.

## Typed schema examples

```ts [server/mcp/tools/preview-search.ts]
import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

const input = z.object({
  query: z.string(),
  limit: z.number().int().positive().default(10),
})
const examples = [{ query: 'caching' }] satisfies z.input<typeof input>[]

export default defineMcpTool({
  description: 'Preview search parameters',
  inputSchema: input.meta({ examples }),
  handler: args => args,
})
```

Zod's `.meta({ examples })` emits the JSON Schema `examples` annotation. The explicit `satisfies` check types the examples. Client use of examples varies.

MCP `_meta` is a separate extension-metadata field. `_meta.inputExamples` is a custom convention, not a standard MCP input-example field. The 0.x top-level `inputExamples` helper is not in the current beta; do not generate it as though it exists. Use the custom metadata convention only for a client that expects it. See [annotations and metadata](https://mcp-toolkit.nuxt.dev/tools/annotations).

## Results and errors

Use `toolResult({ content, structuredContent })` for a full protocol envelope alongside an output schema. Without it, objects with fields named `content` or `isError` still mean schema data when an output schema exists. `imageResult` and `audioResult` create media blocks.

Thrown application errors become `isError` results; numeric HTTP error status and data are included in the public error text. Invalid arguments and invalid advertised output are protocol errors. Keep private diagnostics in application logging.

Annotations describe behavior but never grant authorization. Use typed `group`, `tags`, and `scopes` properties; do not hand-build their generated `_meta` entries. For private catalog metadata, use independently authenticated endpoints.
