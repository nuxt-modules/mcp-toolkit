import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating MCP eval tests with Evalite to verify tool selection and behavior',
  inputSchema: {
    purpose: z.string().describe('What tools or functionality to test (e.g., "test the documentation tools", "verify the BMI calculator", "test all my MCP tools")'),
  },
  handler: async ({ purpose }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an expert developer helping to create MCP eval tests using the Nuxt MCP Toolkit.

## Documentation

- **Official Documentation**: https://mcp-toolkit.nuxt.dev/
- **Evals Guide**: https://mcp-toolkit.nuxt.dev/raw/advanced/evals.md

**IMPORTANT**: Before generating code, always:
1. Identify the tools that need to be tested based on the purpose
2. Understand the purpose of each tool being tested
3. Create realistic user prompts that would naturally trigger each tool
4. Include both simple and complex test scenarios
5. Consider edge cases and multi-step workflows

---

Create eval tests for: ${purpose}

## Instructions

1. First, identify which MCP tools need to be tested based on the purpose
2. For each tool, create test cases with realistic user prompts
3. Create the file at: \`test/mcp.eval.ts\`

## File Location

Create the file at: \`test/mcp.eval.ts\`

## Dependencies

First, install the required dependencies:

\`\`\`bash
pnpm add -D evalite vitest @ai-sdk/mcp ai
\`\`\`

Add scripts to \`package.json\`:

\`\`\`json
{
  "scripts": {
    "eval": "evalite",
    "eval:ui": "evalite watch"
  }
}
\`\`\`

## Eval Template

\`\`\`typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { generateText } from 'ai'
import { evalite } from 'evalite'
import { toolCallAccuracy } from 'evalite/scorers'

/**
 * MCP Evaluation Tests
 *
 * These evals verify that the LLM correctly selects and calls MCP tools.
 *
 * Tools being tested:
${toolList}
 *
 * Run with: pnpm eval
 * Run with UI: pnpm eval:ui
 */

// AI Gateway model format: provider/model-name
const model = 'openai/gpt-5.1-codex-mini'
const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3000/mcp'

evalite('MCP Tool Selection', {
  data: async () => [
${exampleTests},
  ],
  task: async (input) => {
    const mcp = await createMCPClient({ transport: { type: 'http', url: MCP_URL } })
    try {
      const result = await generateText({
        model,
        prompt: input,
        tools: await mcp.tools(),
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [({ output, expected }) => toolCallAccuracy({ actualCalls: output, expectedCalls: expected })],
})
\`\`\`

## Test Data Patterns

### Simple Tool Selection

Test that the correct tool is selected for a given prompt:

\`\`\`typescript
{
  input: 'List all available items',
  expected: [{ toolName: 'list-items' }],
}
\`\`\`

### Tool Selection with Parameters

Verify the tool receives the correct input parameters:

\`\`\`typescript
{
  input: 'Get the item with ID 123',
  expected: [{ toolName: 'get-item', input: { id: '123' } }],
}
\`\`\`

### Multi-Step Workflows

Test workflows that require multiple tool calls (use \`maxSteps\`):

\`\`\`typescript
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
    const mcp = await createMCPClient({ transport: { type: 'http', url: MCP_URL } })
    try {
      const result = await generateText({
        model,
        prompt: input,
        tools: await mcp.tools(),
        maxSteps: 5, // Allow multiple tool calls
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [({ output, expected }) => toolCallAccuracy({ actualCalls: output, expectedCalls: expected })],
})
\`\`\`

## Best Practices

1. **Use realistic prompts**: Write prompts that match how users naturally phrase requests
2. **Test parameter extraction**: Include specific values in prompts to verify correct parameter parsing
3. **Group related tests**: Organize evals by feature or tool category
4. **Start simple**: Begin with happy-path cases before adding edge cases
5. **Test ambiguous cases**: Include prompts that could trigger multiple tools to verify correct selection

## Running Evals

1. Start your MCP server: \`pnpm dev\`
2. In another terminal, run evals: \`pnpm eval\`
3. Or use the UI: \`pnpm eval:ui\` (available at http://localhost:3006)

## Environment Variables

Create a \`.env\` file:

\`\`\`bash
# AI provider key
AI_GATEWAY_API_KEY=your_key

# MCP server endpoint
MCP_URL=http://localhost:3000/mcp
\`\`\`

## Learn More

For more details and advanced patterns, visit the official documentation:
- Full evals guide: https://mcp-toolkit.nuxt.dev/raw/advanced/evals.md`,
          },
        },
      ],
    }
  },
})
