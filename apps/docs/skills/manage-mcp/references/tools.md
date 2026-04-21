# Tool Examples

Detailed examples for creating MCP tools.

## BMI Calculator

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Calculate Body Mass Index',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  inputSchema: {
    height: z.number().describe('Height in meters'),
    weight: z.number().describe('Weight in kilograms'),
  },
  inputExamples: [
    { height: 1.75, weight: 70 },
  ],
  outputSchema: {
    bmi: z.number(),
    category: z.string(),
    healthy: z.boolean(),
  },
  handler: async ({ height, weight }) => {
    const bmi = weight / (height * height)
    const category = bmi < 18.5 ? 'underweight'
      : bmi < 25 ? 'normal'
      : bmi < 30 ? 'overweight'
      : 'obese'

    return {
      content: [{
        type: 'text',
        text: `BMI: ${bmi.toFixed(2)} (${category})`,
      }],
      structuredContent: {
        bmi: parseFloat(bmi.toFixed(2)),
        category,
        healthy: bmi >= 18.5 && bmi < 25,
      },
    }
  },
})
```

## Weather API Integration

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Fetch weather data for a city',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  inputSchema: {
    city: z.string().describe('City name'),
    units: z.enum(['metric', 'imperial']).default('metric').describe('Temperature units'),
  },
  cache: '10m',
  handler: async ({ city, units }) => {
    const apiKey = process.env.WEATHER_API_KEY
    const response = await $fetch('https://api.weather.com/v1/current', {
      query: { city, units, apikey: apiKey },
    })

    return {
      content: [{
        type: 'text',
        text: `Weather in ${city}: ${response.temperature}°${units === 'metric' ? 'C' : 'F'}, ${response.description}`,
      }],
    }
  },
})
```

## Database Operation

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Create a new todo item',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  inputSchema: {
    title: z.string().describe('Todo title'),
    completed: z.boolean().default(false).describe('Completion status'),
  },
  inputExamples: [
    { title: 'Buy groceries' },
    { title: 'Deploy v2', completed: false },
  ],
  handler: async ({ title, completed }) => {
    const todo = await useDrizzle()
      .insert(todos)
      .values({ title, completed })
      .returning()

    return {
      content: [{
        type: 'text',
        text: `Created todo: ${todo[0].title}`,
      }],
    }
  },
})
```

## Interactive Tool (Elicitation)

Ask the user for missing details mid-request and validate the response against a Zod shape.

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Create a release after asking for the channel',
  inputSchema: {
    name: z.string().describe('Release name'),
  },
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

    if (result.action !== 'accept') {
      return `Release cancelled (${result.action}).`
    }

    return `Created "${name}" on ${result.content.channel} (notify=${result.content.notify}).`
  },
})
```

## Observability (Logger)

Stream `notifications/message` to the client and capture a structured wide event for each request.

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Charge a payment method',
  inputSchema: {
    userId: z.string(),
    amount: z.number().int().positive(),
  },
  annotations: { destructiveHint: true, idempotentHint: false },
  handler: async ({ userId, amount }) => {
    const log = useMcpLogger('billing')

    log.set({ user: { id: userId }, billing: { amount } })
    await log.notify.info({ msg: 'starting charge', amount })

    try {
      const receipt = await chargeCard(userId, amount)
      log.event('charge_completed', { receiptId: receipt.id })
      await log.notify.info({ msg: 'charge ok', receiptId: receipt.id })
      return `Charged ${amount}. Receipt: ${receipt.id}`
    }
    catch (err) {
      log.evlog.error('charge failed', err)
      await log.notify.error({ msg: 'charge failed', error: String(err) })
      throw err
    }
  },
})
```

## File Operation

```typescript
import { z } from 'zod'
import { readFile } from 'node:fs/promises'

export default defineMcpTool({
  description: 'Read file contents',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  inputSchema: {
    path: z.string().describe('File path relative to project root'),
  },
  handler: async ({ path }) => {
    try {
      const content = await readFile(path, 'utf-8')
      return {
        content: [{
          type: 'text',
          text: content,
        }],
      }
    }
    catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading file: ${error.message}`,
        }],
        isError: true,
      }
    }
  },
})
```
