# Prompt Examples

Detailed examples for creating MCP prompts.

## Code Review Prompt

```typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate comprehensive code review',
  inputSchema: {
    language: z.string().describe('Programming language'),
    focus: z.array(z.enum(['performance', 'security', 'maintainability', 'tests']))
      .describe('Review focus areas'),
  },
  handler: async ({ language, focus }) => {
    const focusAreas = focus.join(', ')
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please review my ${language} code focusing on: ${focusAreas}.

Provide specific suggestions with examples where possible.`,
        },
      }],
    }
  },
})
```

## Documentation Generator

```typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate API documentation',
  inputSchema: {
    apiType: z.enum(['REST', 'GraphQL', 'gRPC']).describe('API type'),
    includeExamples: z.boolean().default(true).describe('Include code examples'),
  },
  handler: async ({ apiType, includeExamples }) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Generate documentation for this ${apiType} API.
${includeExamples ? 'Include practical code examples.' : ''}

Format:
- Overview
- Endpoints/Operations
- Request/Response schemas
- Error handling
${includeExamples ? '- Usage examples' : ''}`,
        },
      }],
    }
  },
})
```

## Test Generator

```typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate unit tests',
  inputSchema: {
    framework: z.enum(['vitest', 'jest', 'mocha']).describe('Test framework'),
    coverage: z.enum(['basic', 'comprehensive']).default('comprehensive').describe('Test coverage level'),
  },
  handler: async ({ framework, coverage }) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Generate ${coverage} ${framework} tests for this function.

Include:
- Happy path scenarios
- Edge cases
${coverage === 'comprehensive' ? '- Error handling\n- Boundary conditions\n- Mock dependencies' : ''}`,
        },
      }],
    }
  },
})
```

## Multi-Message Debugging Prompt

```typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Structured debugging help',
  inputSchema: {
    issue: z.string().describe('Problem description'),
    environment: z.enum(['development', 'staging', 'production']).describe('Environment'),
  },
  handler: async ({ issue, environment }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I'm debugging an issue in ${environment}:

${issue}

Please help me:
1. Identify the most likely root cause
2. Suggest debugging steps
3. Recommend a solution
4. ${environment === 'production' ? 'Prioritize quick fixes that minimize downtime' : 'Include thorough investigation steps'}`,
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'I\'ll help you debug this systematically. Let me analyze the issue:',
          },
        },
      ],
    }
  },
})
```
