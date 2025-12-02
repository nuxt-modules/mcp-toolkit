import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating MCP eval tests with Evalite to verify tool selection and behavior',
  inputSchema: {
    toolNames: z.string().describe('Comma-separated list of tool names to test (e.g., "list-pages, get-page, calculate-bmi")'),
    projectContext: z.string().optional().describe('Optional description of the project or MCP server context'),
  },
  handler: async ({ toolNames, projectContext }) => {
    const tools = toolNames.split(',').map(t => t.trim()).filter(Boolean)
    const toolList = tools.map(t => `- \`${t}\``).join('\n')

    const exampleTests = tools.map(tool => `    {
      input: 'User prompt that should trigger ${tool}',
      expected: [{ toolName: '${tool}' }],
    }`).join(',\n')

    const contextSection = projectContext
      ? `\n## Project Context\n\n${projectContext}\n`
      : ''

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an expert developer helping to create MCP eval tests.

**IMPORTANT**: Before generating code, always:
1. Understand the purpose of each tool being tested
2. Create realistic user prompts that would naturally trigger each tool
3. Include both simple and complex test scenarios
4. Consider edge cases and multi-step workflows
${contextSection}
---

Create eval tests for the following MCP tools:
${toolList}

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
\`\`\``,
          },
        },
      ],
    }
  },
})
