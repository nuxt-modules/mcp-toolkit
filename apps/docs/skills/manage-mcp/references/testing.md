# Testing Guide

Comprehensive guide for testing MCP tools with Evalite.

## Setup

### Installation

```bash
pnpm add -D evalite vitest @ai-sdk/mcp ai
```

### Configuration

Add to `package.json`:

```json
{
  "scripts": {
    "eval": "evalite",
    "eval:ui": "evalite watch",
    "eval:verbose": "evalite --verbose"
  }
}
```

Create `.env`:

```bash
# AI provider key
OPENAI_API_KEY=your_key_here

# MCP server endpoint
MCP_URL=http://localhost:3000/mcp
```

## Test Patterns

### Testing Natural Language Variations

```typescript
evalite('Natural Language', {
  data: async () => [
    {
      input: 'Calculate BMI for height 1.75m weight 70kg',
      expected: [{ toolName: 'bmi-calculator', input: { height: 1.75, weight: 70 } }],
    },
    {
      input: 'What\'s the BMI of someone 1.75 meters tall weighing 70 kilograms?',
      expected: [{ toolName: 'bmi-calculator', input: { height: 1.75, weight: 70 } }],
    },
    {
      input: 'BMI for 70kg 1.75m person',
      expected: [{ toolName: 'bmi-calculator', input: { height: 1.75, weight: 70 } }],
    },
  ],
  task: async (input) => {
    // ... task implementation
  },
  scorers: [toolCallAccuracy],
})
```

### Testing Tool Selection Accuracy

```typescript
evalite('Tool Selection', {
  data: async () => [
    {
      input: 'Create a new todo',
      expected: [{ toolName: 'create-todo' }],
    },
    {
      input: 'List all todos',
      expected: [{ toolName: 'list-todos' }],
    },
    {
      input: 'Delete todo 123',
      expected: [{ toolName: 'delete-todo', input: { id: '123' } }],
    },
    {
      input: 'Mark todo 456 as complete',
      expected: [{ toolName: 'toggle-todo', input: { id: '456' } }],
    },
  ],
  task: async (input) => {
    // ... task implementation
  },
  scorers: [toolCallAccuracy],
})
```

### Testing Multi-Step Workflows

```typescript
evalite('Multi-Step Workflows', {
  data: async () => [
    {
      input: 'First list all items, then get details for item 123',
      expected: [
        { toolName: 'list-items' },
        { toolName: 'get-item', input: { id: '123' } },
      ],
    },
  ],
  task: async (input) => {
    const mcp = await createMCPClient({
      transport: { type: 'http', url: MCP_URL },
    })
    try {
      const result = await generateText({
        model: 'openai/gpt-4o',
        prompt: input,
        tools: await mcp.tools(),
        maxSteps: 5,  // Allow multiple tool calls
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [toolCallAccuracy],
})
```

### Testing Edge Cases

```typescript
evalite('Edge Cases', {
  data: async () => [
    {
      input: 'Calculate BMI with height 0',
      expected: [{ toolName: 'bmi-calculator', input: { height: 0, weight: 70 } }],
    },
    {
      input: 'Get item with no ID',
      expected: [], // Should not call tool with missing required param
    },
  ],
  task: async (input) => {
    // ... task implementation
  },
  scorers: [toolCallAccuracy],
})
```

## Running Tests

### Command Line

```bash
# Start MCP server
pnpm dev

# Run evals (in another terminal)
pnpm eval

# Verbose output
pnpm eval:verbose
```

### With UI

```bash
# Start server
pnpm dev

# Launch UI (in another terminal)
pnpm eval:ui
```

Visit `http://localhost:3006` to see results.

## Debugging Failed Tests

### Enable Verbose Logging

```typescript
evalite('Debug Test', {
  data: async () => [...],
  task: async (input) => {
    console.log('Input:', input)
    const result = await generateText({ ... })
    console.log('Tool calls:', result.toolCalls)
    return result.toolCalls ?? []
  },
  scorers: [toolCallAccuracy],
})
```

### Check Tool Descriptions

Tools with unclear descriptions may not be selected:

```typescript
// ❌ Poor description
description: 'Does something'

// ✅ Clear description
description: 'Calculate Body Mass Index from height and weight'
```

### Verify Input Schemas

```typescript
inputSchema: {
  // Always add .describe()
  height: z.number().describe('Height in meters'),
  weight: z.number().describe('Weight in kilograms'),
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: MCP Evals

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm dev &
      - run: sleep 10  # Wait for server
      - run: pnpm eval
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```
