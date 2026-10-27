# Testing — 1.0

## Testing and evals

```ts
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'
import handler from '../server/routes/mcp'
import { expect, it } from 'vitest'

it('greets a caller', async () => {
  await using client = await createMcpTestClient(handler)
  expect(textOf(await client.callTool({ name: 'greet', arguments: { name: 'Ada' } }))).toBe('Hello Ada!')
})
```

The helper connects a real SDK client in memory and closes it on scope exit. Pass `{ era: 'legacy' }` to verify 2025 behavior. Use `headers` for authentication or a tool allowlist.

Use a built Nuxt fixture to verify discovery, layers, middleware, generated imports, and streaming. Keep service logic and schema tests fast and independent of a full application build. Model evals complement these checks; they do not replace protocol or authorization tests.

## Inspector

Start Nuxt and open the MCP Inspector tab in Nuxt DevTools. The launcher opens the official inspector in a separate tab.

You can also run:

```sh
npx @modelcontextprotocol/inspector
```

Choose Streamable HTTP and enter `http://localhost:3000/mcp`. Configure authorization headers when the endpoint requires a credential. Each named endpoint has its own catalog and authentication.

For repeatable checks, use the [in-memory testing helpers](/advanced/evals). Verify a legacy client as well as a modern client when using capabilities that differ between revisions.
