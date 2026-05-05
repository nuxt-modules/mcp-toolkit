# Tool Examples

Modern, copy-pasteable examples for `defineMcpTool`. All examples use **direct returns** (the toolkit auto-wraps strings, numbers, booleans, objects, and arrays into the right MCP shape) and **`throw createError({ statusCode, message })`** for failures.

## BMI Calculator (typed structured output)

```typescript [server/mcp/tools/bmi-calculator.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Calculate Body Mass Index',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    height: z.number().positive().describe('Height in meters'),
    weight: z.number().positive().describe('Weight in kilograms'),
  },
  inputExamples: [{ height: 1.75, weight: 70 }],
  outputSchema: {
    bmi: z.number(),
    category: z.string(),
    healthy: z.boolean(),
  },
  handler: async ({ height, weight }) => {
    const bmi = +(weight / (height * height)).toFixed(2)
    const category = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese'
    return {
      structuredContent: { bmi, category, healthy: bmi >= 18.5 && bmi < 25 },
    }
  },
})
```

The toolkit auto-generates a text fallback (`JSON.stringify(structuredContent)`) when only `structuredContent` is set, so older clients still see something readable.

## External API (third-party fetch + caching)

```typescript [server/mcp/tools/weather.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Fetch current weather for a city',
  annotations: { readOnlyHint: true, openWorldHint: true },
  cache: '10m',
  inputSchema: {
    city: z.string().min(1).describe('City name'),
    units: z.enum(['metric', 'imperial']).default('metric').describe('Temperature units'),
  },
  handler: async ({ city, units }) => {
    const apiKey = process.env.WEATHER_API_KEY
    if (!apiKey) throw createError({ statusCode: 500, message: 'WEATHER_API_KEY missing' })

    const data = await $fetch<{ temperature: number, description: string }>('https://api.weather.com/v1/current', {
      query: { city, units, apikey: apiKey },
    })

    return `Weather in ${city}: ${data.temperature}°${units === 'metric' ? 'C' : 'F'}, ${data.description}`
  },
})
```

`cache: '10m'` keys on the input arguments. Pass a full Nitro cache options object for `swr`, custom `getKey`, etc. ([Nitro caching →](https://nitro.build/guide/cache#options))

`swr` defaults to `false` here (Nitro defaults to `true`). With `swr: true`, the handler refreshes after the response is sent, so request-scoped logs/traces may be dropped — opt in only when you accept that.

## Database Mutation (DB + soft auth + observability)

```typescript [server/mcp/tools/create-todo.ts]
import { z } from 'zod'
import { useDrizzle } from '~/server/utils/drizzle'
import { todos } from '~/server/db/schema'

export default defineMcpTool({
  description: 'Create a new todo for the current user',
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  enabled: event => Boolean(event.context.user), // hidden when unauthenticated
  inputSchema: {
    title: z.string().min(1).describe('Todo title'),
    completed: z.boolean().default(false).describe('Completion status'),
  },
  inputExamples: [
    { title: 'Buy groceries' },
    { title: 'Deploy v2', completed: false },
  ],
  handler: async ({ title, completed }) => {
    const event = useEvent()
    const log = useMcpLogger('todos')

    const [todo] = await useDrizzle()
      .insert(todos)
      .values({ title, completed, userId: event.context.user.id })
      .returning()

    log.event('todo_created', { todoId: todo.id })
    return todo // plain object — auto-stringified by the toolkit
  },
})
```

## File Operation (graceful errors)

```typescript [server/mcp/tools/read-file.ts]
import { z } from 'zod'
import { readFile, access } from 'node:fs/promises'

export default defineMcpTool({
  description: 'Read the contents of a project file',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    path: z.string().describe('Path relative to project root'),
  },
  handler: async ({ path }) => {
    try {
      await access(path)
    }
    catch {
      throw createError({ statusCode: 404, message: `File not found: ${path}` })
    }
    return await readFile(path, 'utf-8')
  },
})
```

## Image Tool (`imageResult`)

```typescript [server/mcp/tools/screenshot.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Capture a screenshot of a URL',
  annotations: { readOnlyHint: true, openWorldHint: true },
  inputSchema: { url: z.string().url().describe('Page to capture') },
  handler: async ({ url }) => {
    const buffer = await captureUrl(url) // your screenshot util
    return imageResult(buffer.toString('base64'), 'image/png')
  },
})
```

## Audio Tool (`audioResult`)

```typescript [server/mcp/tools/synthesize-speech.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Synthesize speech from text',
  inputSchema: {
    text: z.string().min(1),
    voice: z.enum(['alloy', 'nova', 'shimmer']).default('alloy'),
  },
  handler: async ({ text, voice }) => {
    const audio = await synthesize({ text, voice })
    return audioResult(audio.toString('base64'), 'audio/mp3')
  },
})
```

## Interactive Tool (Elicitation)

Ask the user for missing details mid-request:

```typescript [server/mcp/tools/create-release.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Create a release after asking for the channel',
  inputSchema: { name: z.string().describe('Release name') },
  handler: async ({ name }) => {
    const elicit = useMcpElicitation()
    if (!elicit.supports('form')) {
      return `Use a client that supports elicitation, then re-run for "${name}".`
    }

    const result = await elicit.form({
      message: `Pick a release channel for "${name}"`,
      schema: {
        channel: z.enum(['stable', 'beta', 'canary']).describe('Release channel'),
        notify: z.boolean().default(true).describe('Notify subscribers'),
      },
    })

    if (result.action !== 'accept') return `Release cancelled (${result.action}).`
    return `Created "${name}" on ${result.content.channel} (notify=${result.content.notify}).`
  },
})
```

Requires `nitro.experimental.asyncContext: true`.

## Observability (`useMcpLogger`)

Stream `notifications/message` to the client and capture a structured wide event for the request:

```typescript [server/mcp/tools/charge-card.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Charge a payment method',
  annotations: { destructiveHint: true, idempotentHint: false },
  inputSchema: {
    userId: z.string(),
    amount: z.number().int().positive(),
  },
  handler: async ({ userId, amount }) => {
    const log = useMcpLogger('billing')

    log.set({ billing: { amount } })
    await log.notify.info({ msg: 'starting charge', amount })

    try {
      const receipt = await chargeCard(userId, amount)
      log.event('charge_completed', { receiptId: receipt.id })
      await log.notify.info({ msg: 'charge ok', receiptId: receipt.id })
      return `Charged ${amount}. Receipt: ${receipt.id}`
    }
    catch (err) {
      log.evlog.error('charge failed', err as Error)
      await log.notify.error({ msg: 'charge failed', error: String(err) })
      throw err // re-throw → returned as `isError`
    }
  },
})
```

Wide events are auto-tagged with `mcp.tool: 'charge-card'`, `mcp.session_id`, `mcp.request_id`, `service: '<env.service>/mcp'`, and (when middleware sets them) `user.id` / `session.id`.

## Tool with Session State

```typescript [server/mcp/tools/remember.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Remember a fact for this session',
  inputSchema: {
    key: z.string().describe('Fact key'),
    value: z.string().describe('Fact value'),
  },
  handler: async ({ key, value }) => {
    const session = useMcpSession<{ facts: Record<string, string> }>()
    const facts = (await session.get('facts')) ?? {}
    facts[key] = value
    await session.set('facts', facts)
    return `Remembered ${Object.keys(facts).length} fact(s).`
  },
})
```

Requires `mcp.sessions: true` in `nuxt.config.ts`.

## See also

- [Tools docs](https://mcp-toolkit.nuxt.dev/tools/overview)
- [Schema, handler & returns](https://mcp-toolkit.nuxt.dev/tools/schema-handler)
- [Annotations & input examples](https://mcp-toolkit.nuxt.dev/tools/annotations)
- [Errors & response caching](https://mcp-toolkit.nuxt.dev/tools/errors-caching)
- [Groups, files & dynamic registration](https://mcp-toolkit.nuxt.dev/tools/groups-organization)
