---
name: manage-mcp
description: Manage MCP servers in Nuxt - setup, create, customize with middleware, review, and troubleshoot
---

# Manage MCP

Complete skill for managing Model Context Protocol (MCP) servers in Nuxt applications. Setup, create, customize with middleware and handlers, review, and troubleshoot.

## When to Use

- **Setup**: "Setup an MCP server in my Nuxt app"
- **Create**: "Create a tool to calculate BMI" / "Add a resource to read the README"
- **Customize**: "Add authentication to my MCP server" / "Create middleware for rate limiting"
- **Review**: "Review my MCP implementation" / "Check for best practices"
- **Troubleshoot**: "My auto-imports aren't working" / "Cannot connect to endpoint"
- **Test**: "Create tests for my MCP tools"

---

## Setup MCP Server

### Installation

**Automatic (recommended):**
```bash
npx nuxt module add mcp-toolkit
```

**Manual:**
```bash
pnpm add -D @nuxtjs/mcp-toolkit zod
```

Add to `nuxt.config.ts`:
```typescript
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    name: 'My MCP Server',
  },
})
```

### Directory Structure

```
server/mcp/
├── tools/           # Actions AI can perform
│   ├── admin/       # Subdirectory → group: 'admin'
│   └── content/     # Subdirectory → group: 'content'
├── resources/       # Data AI can read
└── prompts/         # Message templates
```

### Verification

1. Start: `pnpm dev`
2. Check: `http://localhost:3000/mcp` (should redirect)
3. Open DevTools (Shift+Alt+D) → MCP tab

---

## Create Tools

Tools are functions AI assistants can call.

### Basic Structure

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'What the tool does',
  inputSchema: {
    param: z.string().describe('Parameter description'),
  },
  handler: async ({ param }) => {
    return 'Result' // or return { foo: 'bar' } for JSON; full CallToolResult still supported
  },
})
```

### Input Patterns

```typescript
// Required
name: z.string().describe('User name')

// Optional with default
limit: z.number().default(10).describe('Max results')

// Enum
format: z.enum(['json', 'xml']).describe('Format')

// Array
tags: z.array(z.string()).describe('Tags')
```

### Error Handling

```typescript
if (!param) {
  throw createError({ statusCode: 400, message: 'Error: param required' })
}
```

### Annotations

Behavioral hints that help MCP clients decide when to prompt for confirmation:

```typescript
export default defineMcpTool({
  annotations: {
    readOnlyHint: true,     // Only reads data, no side effects
    destructiveHint: false,  // Does not delete or destroy data
    idempotentHint: false,   // Multiple calls may have different effects
    openWorldHint: false,    // No external API calls
  },
  // ...
})
```

Common patterns: read-only tools → `readOnlyHint: true`, create → `idempotentHint: false`, update → `idempotentHint: true`, delete → `destructiveHint: true, idempotentHint: true`.

### Input Examples

Type-safe usage examples that help AI models fill in parameters correctly:

```typescript
export default defineMcpTool({
  inputSchema: {
    title: z.string().describe('Todo title'),
    content: z.string().optional().describe('Description'),
  },
  inputExamples: [
    { title: 'Buy groceries', content: 'Milk, eggs, bread' },
    { title: 'Fix login bug' },
  ],
  // ...
})
```

### Groups and Tags

Organize tools with `group` and `tags` for filtering and progressive discovery:

```typescript
export default defineMcpTool({
  group: 'admin',
  tags: ['destructive', 'user-management'],
  description: 'Delete a user account',
  // ...
})
```

Groups are auto-inferred from subdirectories: `server/mcp/tools/admin/delete-user.ts` → `group: 'admin'`. Explicit `group` takes precedence.

### Caching

```typescript
export default defineMcpTool({
  cache: '5m',  // 5 minutes
  // ...
})
```

See [detailed examples →](./references/tools.md)

---

## Create Resources

Resources expose read-only data.

### File Resource

```typescript
import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  description: 'Read a file',
  uri: 'file:///README.md',
  mimeType: 'text/markdown',
  handler: async (uri: URL) => {
    const content = await readFile('README.md', 'utf-8')
    return {
      contents: [{
        uri: uri.toString(),
        text: content,
        mimeType: 'text/markdown',
      }],
    }
  },
})
```

### API Resource

```typescript
export default defineMcpResource({
  description: 'Fetch API data',
  uri: 'api:///users',
  mimeType: 'application/json',
  cache: '5m',
  handler: async (uri: URL) => {
    const data = await $fetch('https://api.example.com/users')
    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
      }],
    }
  },
})
```

### Dynamic Resource

```typescript
import { z } from 'zod'

export default defineMcpResource({
  description: 'Fetch by ID',
  uriTemplate: {
    uriTemplate: 'user:///{id}',
    arguments: {
      id: z.string().describe('User ID'),
    },
  },
  handler: async (uri: URL, args) => {
    const user = await fetchUser(args.id)
    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(user),
        mimeType: 'application/json',
      }],
    }
  },
})
```

See [detailed examples →](./references/resources.md)

---

## Create Prompts

Prompts are reusable message templates.

### Static Prompt

```typescript
export default defineMcpPrompt({
  description: 'Code review',
  handler: async () => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'Review this code for best practices.',
        },
      }],
    }
  },
})
```

### Dynamic Prompt

```typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Custom review',
  inputSchema: {
    language: z.string().describe('Language'),
    focus: z.array(z.string()).describe('Focus areas'),
  },
  handler: async ({ language, focus }) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Review my ${language} code: ${focus.join(', ')}`,
        },
      }],
    }
  },
})
```

See [detailed examples →](./references/prompts.md)

---

## Middleware & Handlers

Customize MCP behavior with middleware and handlers for authentication, logging, rate limiting, and more.

### Basic Middleware

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    console.log('MCP Request:', event.path)

    // Check auth
    const token = event.headers.get('authorization')
    if (!token) {
      return createError({ statusCode: 401, message: 'Unauthorized' })
    }

    return next()
  },
})
```

### Custom Handler

```typescript
// server/mcp/handlers/custom.ts
export default defineMcpHandler({
  name: 'custom-mcp',
  route: '/mcp/custom',
  handler: async (event) => {
    return {
      tools: await loadCustomTools(),
      resources: [],
      prompts: [],
    }
  },
})
```

### Common Use Cases

- **Authentication**: API keys, JWT tokens
- **Rate limiting**: Per IP or per user
- **Logging**: Request/response tracking
- **CORS**: Cross-origin configuration
- **Multiple endpoints**: Public/admin separation

See [detailed middleware guide →](./references/middleware.md)

---

## Interactive Composables

### `useMcpElicitation()`

Ask the connected client for structured input mid-request, or send the user to a URL.

```typescript
import { z } from 'zod'

export default defineMcpTool({
  name: 'create_release',
  inputSchema: { name: z.string() },
  handler: async ({ name }) => {
    const elicit = useMcpElicitation()

    const result = await elicit.form({
      message: `Pick a channel for "${name}"`,
      schema: {
        channel: z.enum(['stable', 'beta']).describe('Release channel'),
      },
    })

    if (result.action !== 'accept') return 'Cancelled.'
    return `Released "${name}" on ${result.content.channel}.`
  },
})
```

- **Form mode**: pass a Zod raw shape, the response is validated and typed.
- **URL mode**: `elicit.url({ message, url })` — opt-in per spec, gate with `elicit.supports('url')`.
- **Confirm**: `await elicit.confirm('Continue?')` returns a boolean.
- **Capability check**: `elicit.supports('form' | 'url')` — always `false` before init completes.
- **Errors**: catch `McpElicitationError` (`code: 'unsupported' | 'invalid-schema' | 'invalid-response'`) to fall back when the client doesn't support elicitation.
- Schema must be a **flat object of primitives** (string/number/boolean), enums, or string-enum arrays — nested objects are rejected by the spec.

See [elicitation docs →](https://mcp-toolkit.nuxt.dev/advanced/elicitation)

---

## Observability

### `useMcpLogger()`

Split-channel logger. `notify` goes to the connected client; `set` / `event` / `setUser` / `setSession` / `evlog` feed the request's wide event when [evlog](https://evlog.dev) is installed.

```typescript
export default defineMcpTool({
  name: 'charge_card',
  inputSchema: { userId: z.string(), amount: z.number().int() },
  handler: async ({ userId, amount }) => {
    const log = useMcpLogger('billing')
    log.set({ billing: { amount } })
    await log.notify.info({ msg: 'starting charge', amount })
    return `Charged ${amount}.`
  },
})
```

- **Client** (`log.notify`): `notify(level, data, logger?)` + `.debug` / `.info` / `.warning` / `.error`. Always resolves, never throws. Works with or without `evlog`.
- **Server** (requires `evlog/nuxt`): `set` / `event` / `setUser({ id, email, name })` / `setSession({ id })` / `evlog`. Throws `McpObservabilityNotEnabledError` when off.
- Wide events are auto-tagged: `mcp.*` from the JSON-RPC body, `user.*` / `session.*` from `event.context.user` / `event.context.session` (so any auth middleware that follows the Nuxt convention — better-auth, API key, … — flows through), and `service: '<evlog.env.service>/mcp'` on the MCP route.
- Setup: install evlog, register `'evlog/nuxt'` in `modules`, configure from the top-level `evlog: { … }` key:

  ```typescript [nuxt.config.ts]
  export default defineNuxtConfig({
    modules: ['evlog/nuxt', '@nuxtjs/mcp-toolkit'],
    evlog: { env: { service: 'my-app' } },
  })
  ```

- `mcp.logging`: omit (auto), `true` (assert `evlog/nuxt` is registered), `false` (opt out).

#### Ship to a backend (drains)

Ship every MCP wide event to **Axiom, Sentry, OTLP, HyperDX, Datadog, Better Stack, or PostHog** with a single Nitro plugin. Each adapter lives under `evlog/adapters/*` and is registered on the `evlog:drain` hook:

```typescript [server/plugins/evlog-axiom.ts]
import { createAxiomDrain } from 'evlog/adapters/axiom'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('evlog:drain', createAxiomDrain())
})
```

The hook is additive — register multiple drains in parallel. Custom drains are just `(ctx) => Promise<void>` registered on the same hook.

See [evlog.dev →](https://evlog.dev) for the full list of adapters, env-var conventions, sampling, and redaction.

See [logging docs →](https://mcp-toolkit.nuxt.dev/advanced/logging)

---

## Review & Best Practices

### MCP code review (agents & humans)

When reviewing or modernizing `server/mcp/**`, walk through this list so implementations stay aligned with current toolkit behavior and Nuxt server typing.

**Tool return values**

- Prefer **direct returns**: `string`, `number`, `boolean`, plain objects, or arrays. The module wraps them into `CallToolResult` (JSON is pretty-printed for objects).
- **Avoid deprecated helpers** unless you must support very old code: `textResult`, `jsonResult`, `errorResult` — migrate to direct values and `throw createError({ statusCode, message })` (or `throw new Error(...)`) for failures.
- Reserve **full `CallToolResult`** (`content`, `structuredContent`, embedded resources, `isError`) for cases that need explicit MCP shapes.

**Async context & server composables**

- **`useMcpServer()`** needs `nitro.experimental.asyncContext: true` in `nuxt.config`. If TypeScript reports `Promise<McpServerHelper>` (common with server auto-imports), use `const mcp = await useMcpServer()` before `registerTool` / `removeTool` / etc.
- **`useMcpSession()`** / **`useEvent()`**: await if the IDE or `vue-tsc` indicates a `Promise`; keep session and event usage inside tool, resource, or prompt handlers.

**Hygiene**

- Every **`await`** on a Promise-backed call in handlers (DB, `fetch`, composables that return promises).
- **Zod**: required `.describe()` on schema fields for good model UX; use `inputExamples` for non-trivial shapes.
- **Annotations**: set `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` honestly.
- Run **`pnpm eslint`** / **`nuxi typecheck`** on the app after refactors (catch deprecated APIs and missing `await` early).

### Tool Checklist

✅ Use kebab-case filenames
✅ Add `.describe()` to all Zod fields
✅ Return plain values or throw `createError` for failures (not deprecated `errorResult`)
✅ Add caching for expensive ops
✅ Clear, actionable descriptions
✅ Validate all inputs
✅ Add `annotations` (readOnlyHint, destructiveHint, etc.)
✅ Add `inputExamples` for tools with optional/complex params
✅ `nitro.experimental.asyncContext: true` when using `useMcpServer()`

❌ Generic descriptions
❌ Skip error handling
❌ Expose sensitive data
❌ No input validation
❌ `textResult` / `jsonResult` / `errorResult` in new code (deprecated)

### Resource Checklist

✅ Descriptive URIs (`config:///app`)
✅ Set appropriate MIME types
✅ Enable caching when needed
✅ Handle errors gracefully
✅ Use URI templates for collections

❌ Unclear URI schemes
❌ Skip MIME types
❌ Expose sensitive data
❌ Return huge datasets without pagination

### Prompt Checklist

✅ Clear descriptions
✅ Meaningful parameters
✅ Default values where appropriate
✅ Single, focused purpose
✅ Reusable design

❌ Overly complex
❌ Skip descriptions
❌ Mix multiple concerns

---

## Troubleshooting

### Auto-imports Not Working

**Fix:**
1. Check `modules: ['@nuxtjs/mcp-toolkit']` in config
2. Restart dev server
3. Files in `server/mcp/` directory?
4. Run `pnpm nuxt prepare`

### Endpoint Not Accessible

**Fix:**
1. Dev server running?
2. Test: `curl http://localhost:3000/mcp`
3. Check `enabled: true` in config
4. Review server logs

### Validation Errors

**Fix:**
- Required fields provided?
- Types match schema?
- Use `.optional()` for optional fields
- Enum values exact match?

### Tool Not Discovered

**Fix:**
- File extension `.ts` or `.js`?
- Using `export default`?
- File in correct directory?
- Restart dev server

See [detailed troubleshooting →](./references/troubleshooting.md)

---

## Testing with Evals

### Setup

```bash
pnpm add -D evalite vitest @ai-sdk/mcp ai
```

Add to `package.json`:
```json
{
  "scripts": {
    "eval": "evalite",
    "eval:ui": "evalite watch"
  }
}
```

### Basic Test

Create `test/mcp.eval.ts`:
```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { generateText } from 'ai'
import { evalite } from 'evalite'
import { toolCallAccuracy } from 'evalite/scorers'

evalite('MCP Tool Selection', {
  data: async () => [
    {
      input: 'Calculate BMI for 70kg 1.75m',
      expected: [{
        toolName: 'bmi-calculator',
        input: { weight: 70, height: 1.75 },
      }],
    },
  ],
  task: async (input) => {
    const mcp = await createMCPClient({
      transport: { type: 'http', url: 'http://localhost:3000/mcp' },
    })
    try {
      const result = await generateText({
        model: 'openai/gpt-4o',
        prompt: input,
        tools: await mcp.tools(),
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [
    ({ output, expected }) => toolCallAccuracy({
      actualCalls: output,
      expectedCalls: expected,
    }),
  ],
})
```

### Running

```bash
# Start server
pnpm dev

# Run tests (in another terminal)
pnpm eval

# Or with UI
pnpm eval:ui  # http://localhost:3006
```

See [detailed testing guide →](./references/testing.md)

---

## Quick Reference

### Common Commands

```bash
# Setup
npx nuxt module add mcp-toolkit

# Dev
pnpm dev

# Test endpoint
curl http://localhost:3000/mcp

# Regenerate types
pnpm nuxt prepare

# Run evals
pnpm eval
```

### Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  mcp: {
    name: 'My Server',
    route: '/mcp',
    enabled: true,
    dir: 'mcp',
  },
})
```

### Debug Tools

- **DevTools**: Shift+Alt+D → MCP tab
- **Logs**: Check terminal
- **curl**: Test endpoint

## Learn More

- [Documentation](https://mcp-toolkit.nuxt.dev/)
- [Tools Guide](https://mcp-toolkit.nuxt.dev/tools/overview)
- [Resources Guide](https://mcp-toolkit.nuxt.dev/resources/overview)
- [Prompts Guide](https://mcp-toolkit.nuxt.dev/prompts/overview)
- [MCP Protocol](https://modelcontextprotocol.io/)
