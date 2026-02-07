# Tool Examples

Detailed examples for creating MCP tools.

## BMI Calculator

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Calculate Body Mass Index',
  inputSchema: {
    height: z.number().describe('Height in meters'),
    weight: z.number().describe('Weight in kilograms'),
  },
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
  inputSchema: {
    title: z.string().describe('Todo title'),
    completed: z.boolean().default(false).describe('Completion status'),
  },
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

## File Operation

```typescript
import { z } from 'zod'
import { readFile } from 'node:fs/promises'

export default defineMcpTool({
  description: 'Read file contents',
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
