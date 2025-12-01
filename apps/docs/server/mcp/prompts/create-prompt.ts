import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating a new MCP prompt with best practices',
  inputSchema: {
    promptName: z.string().describe('Name of the prompt to create (kebab-case)'),
    promptPurpose: z.string().describe('What the prompt helps with'),
    hasArguments: z.enum(['yes', 'no']).default('yes').describe('Whether the prompt accepts arguments'),
  },
  handler: async ({ promptName, promptPurpose, hasArguments }) => {
    const simpleTemplate = `export default defineMcpPrompt({
  description: '${promptPurpose}',
  handler: async () => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'Your prompt text here',
        },
      }],
    }
  },
})`

    const withArgsTemplate = `import { z } from 'zod'

export default defineMcpPrompt({
  description: '${promptPurpose}',
  inputSchema: {
    // Define arguments that customize the prompt
    topic: z.string().describe('The topic to focus on'),
    style: z.enum(['formal', 'casual', 'technical']).default('formal').describe('Writing style'),
  },
  handler: async ({ topic, style }) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: \`Please help me with \${topic} in a \${style} style.\`,
        },
      }],
    }
  },
})`

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Create an MCP prompt named "${promptName}" that ${promptPurpose}.

## File Location

Create the file at: \`server/mcp/prompts/${promptName}.ts\`

## Prompt Template

\`\`\`typescript
${hasArguments === 'yes' ? withArgsTemplate : simpleTemplate}
\`\`\`

## Message Roles

Prompts can return messages with different roles:

### User Role (Most Common)
\`\`\`typescript
{
  role: 'user',
  content: { type: 'text', text: 'User instruction' },
}
\`\`\`

### System Role (Set AI Behavior)
\`\`\`typescript
{
  role: 'system',
  content: { type: 'text', text: 'You are a helpful assistant specialized in...' },
}
\`\`\`

### Assistant Role (Pre-fill Response)
\`\`\`typescript
{
  role: 'assistant',
  content: { type: 'text', text: 'I understand. Let me...' },
}
\`\`\`

## Multiple Messages Pattern

For complex prompts, use multiple messages:

\`\`\`typescript
handler: async ({ topic }) => {
  return {
    messages: [
      {
        role: 'system',
        content: {
          type: 'text',
          text: 'You are an expert developer.',
        },
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: \`Help me understand \${topic}.\`,
        },
      },
    ],
  }
}
\`\`\`

## Best Practices

1. **Clear descriptions**: Help users understand what the prompt does
2. **Meaningful arguments**: Use \`.describe()\` for all Zod fields
3. **Default values**: Use \`.default()\` for optional customization
4. **Focused purpose**: Each prompt should have a single, clear goal
5. **Reusable templates**: Design prompts that work across different contexts

## Common Use Cases

- **Code review**: System prompt for review guidelines + user prompt with code
- **Documentation**: Generate docs for code/APIs
- **Translation**: Multi-language support with language argument
- **Onboarding**: Setup instructions for new developers
- **Debugging**: Structured troubleshooting prompts`,
          },
        },
      ],
    }
  },
})
