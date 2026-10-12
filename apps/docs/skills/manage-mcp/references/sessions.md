# Sessions — Persistent State

By default the MCP server is **stateless** — every request gets a fresh server instance. Enable sessions to maintain state across multiple tool calls, support SSE streaming, and enable elicitation.

## Setup

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    sessions: true,
  },
  nitro: {
    experimental: { asyncContext: true }, // required by useMcpSession()
  },
})
```

Configure timeouts and capacity:

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  mcp: {
    sessions: {
      enabled: true,
      maxDuration: 60 * 60 * 1000, // 1 hour (default: 30 minutes)
      maxSessions: 1000,           // before new sessions return 503
    },
  },
})
```

When sessions are on the server assigns an `Mcp-Session-Id` header on `initialize` and the client sends it back on every subsequent request.

Sessions need the Node server runtime: on Cloudflare Workers the transport is stateless, never assigns an id, and `useMcpSession()` throws. `useMcpSession()` works in tool, resource and prompt handlers for server-assigned sessions only — not in `middleware`, and not for an id the client made up.

## `useMcpSession<T>()`

Auto-imported into every server file. Returns a typed key-value store backed by [unstorage](https://unstorage.unjs.io). The composable itself is **synchronous** — only the store methods are async.

```typescript [server/mcp/tools/counter.ts]
import { z } from 'zod'

interface CounterSession {
  counter: number
}

export default defineMcpTool({
  description: 'Increment a per-session counter',
  handler: async () => {
    const session = useMcpSession<CounterSession>()
    const count = (await session.get('counter')) ?? 0
    await session.set('counter', count + 1)
    return `Counter: ${count + 1}`
  },
})
```

TypeScript enforces:

- `session.get('counter')` returns `Promise<number | null>`
- `session.set('counter', 'wrong')` is a compile error
- `session.get('unknown_key')` is a compile error

### Untyped store

```typescript
const session = useMcpSession()
await session.set('key', { any: 'value' })
const data = await session.get('key')
```

### API

| Method | Description |
| --- | --- |
| `get(key)` | Retrieve a value (returns `null` if missing) |
| `set(key, value)` | Store a value |
| `remove(key)` | Delete a key |
| `has(key)` | Check if a key exists |
| `keys()` | List all keys in the session |
| `clear()` | Remove all data from the session |
| `storage` | Access the underlying unstorage instance |

All methods except `storage` are asynchronous.

## Common Patterns

### Notepad (accumulating data across tool calls)

```typescript [server/mcp/tools/add-note.ts]
import { z } from 'zod'

interface NotesSession {
  notes: { text: string, createdAt: string }[]
}

export default defineMcpTool({
  description: 'Add a note to the session notepad',
  inputSchema: { note: z.string().describe('Note content') },
  handler: async ({ note }) => {
    const session = useMcpSession<NotesSession>()
    const notes = (await session.get('notes')) ?? []
    notes.push({ text: note, createdAt: new Date().toISOString() })
    await session.set('notes', notes)
    return `Note added (${notes.length} total).`
  },
})
```

```typescript [server/mcp/tools/get-notes.ts]
interface NotesSession {
  notes: { text: string, createdAt: string }[]
}

export default defineMcpTool({
  description: 'Retrieve all notes from the session notepad',
  handler: async () => {
    const session = useMcpSession<NotesSession>()
    const notes = (await session.get('notes')) ?? []
    if (notes.length === 0) return 'No notes yet.'
    return notes
  },
})
```

### Multi-Step Wizard

```typescript [server/mcp/tools/wizard.ts]
import { z } from 'zod'

interface WizardSession {
  step: number
  answers: Record<string, string>
}

export default defineMcpTool({
  description: 'Guide the user through a setup wizard',
  inputSchema: {
    answer: z.string().optional().describe('Answer to the previous question'),
  },
  handler: async ({ answer }) => {
    const session = useMcpSession<WizardSession>()
    const state = (await session.get('step')) ?? 0
    const answers = (await session.get('answers')) ?? {}

    const questions = ['What is your name?', 'Pick a framework?', 'Add tests?']
    if (state > 0 && answer) {
      answers[questions[state - 1]] = answer
      await session.set('answers', answers)
    }
    if (state >= questions.length) {
      await session.clear()
      return `Done! Answers: ${JSON.stringify(answers, null, 2)}`
    }

    await session.set('step', state + 1)
    return questions[state]
  },
})
```

### Per-Session Rate Limiting

```typescript
interface RateLimitSession {
  calls: { ts: number }[]
}

export default defineMcpTool({
  description: 'Rate-limited operation',
  handler: async () => {
    const session = useMcpSession<RateLimitSession>()
    const now = Date.now()
    const window = 60_000
    const limit = 10

    const calls = ((await session.get('calls')) ?? []).filter(c => now - c.ts < window)
    if (calls.length >= limit) {
      throw createError({ statusCode: 429, message: 'Slow down (10 req/min limit).' })
    }
    calls.push({ ts: now })
    await session.set('calls', calls)

    return 'OK'
  },
})
```

## Storage Backends

Sessions use Nitro's storage layer. By default, two in-memory drivers are auto-registered:

```typescript
nitroOptions.storage['mcp:sessions'] = { driver: 'memory' }
nitroOptions.storage['mcp:sessions-meta'] = { driver: 'memory' }
```

For production, override with a persistent driver (Redis, Cloudflare KV, file system):

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  mcp: { sessions: true },
  nitro: {
    storage: {
      'mcp:sessions': {
        driver: 'redis',
        url: process.env.REDIS_URL,
      },
      'mcp:sessions-meta': {
        driver: 'redis',
        url: process.env.REDIS_URL,
      },
    },
  },
})
```

## Invalidating Sessions

Use `invalidateMcpSession()` from middleware when auth state changes (e.g. token revocation) — forces the client to re-initialize:

```typescript [server/mcp/index.ts]
import { invalidateMcpSession } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({
  middleware: async (event) => {
    const apiKey = getHeader(event, 'authorization')?.replace('Bearer ', '')
    const user = apiKey ? await verifyApiKey(apiKey).catch(() => null) : null

    if (event.context.user && !user) {
      // User was logged in but their token is now invalid
      invalidateMcpSession()
    }
    if (user) event.context.user = user
  },
})
```

## See also

- [Sessions docs](https://mcp-toolkit.nuxt.dev/advanced/sessions)
- [Configuration](https://mcp-toolkit.nuxt.dev/getting-started/configuration) — `mcp.sessions` options
- [Logging](https://mcp-toolkit.nuxt.dev/advanced/logging) — every wide event auto-tags `mcp.session_id`
