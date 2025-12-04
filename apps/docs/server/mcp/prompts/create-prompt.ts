import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating a new MCP prompt with best practices',
  inputSchema: {
    purpose: z.string().describe('What the prompt should help with (e.g., "code review for Vue components", "generate unit tests for a function")'),
  },
  handler: async ({ purpose }) => {
    const simpleTemplate = `export default defineMcpPrompt({
  description: 'Clear description of what the prompt helps with',
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
  description: 'Clear description of what the prompt helps with',
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
            text: `You are an expert developer helping to create MCP prompts using the Nuxt MCP Toolkit.

## Documentation

- **Official Documentation**: https://mcp-toolkit.nuxt.dev/
- **Prompts Guide**: https://mcp-toolkit.nuxt.dev/raw/core-concepts/prompts.md
- **Prompt Examples**: https://mcp-toolkit.nuxt.dev/raw/examples/prompt-examples.md

**IMPORTANT**: Before generating code, always:
1. Generate an appropriate prompt name in kebab-case based on the purpose
2. Use consistent naming conventions (kebab-case for filenames, camelCase for variables)
3. Ensure descriptions are clear, professional, and grammatically correct
4. Proofread and fix any spelling or grammar mistakes in the provided purpose
5. Decide if the prompt needs arguments based on the purpose

---

Create an MCP prompt that: ${purpose}

## Instructions

1. First, determine an appropriate prompt name in kebab-case based on the purpose
2. Decide if the prompt needs input arguments (for customization) or not
3. Create the file at: \`server/mcp/prompts/<prompt-name>.ts\`

## Prompt Templates

### Without Arguments (Static Prompt)

\`\`\`typescript
${simpleTemplate}
\`\`\`

### With Arguments (Dynamic Prompt)

\`\`\`typescript
${withArgsTemplate}
\`\`\`

## Message Roles

Prompts can return messages with different roles:

### User Role (Most Common)
\`\`\`typescript
{
  role: 'user',
  content: { type: 'text', text: 'User instruction with context' },
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

For complex prompts, combine user and assistant messages:

\`\`\`typescript
handler: async ({ topic }) => {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: \`You are an expert developer. Help me understand \${topic}.\`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: 'I\\'ll analyze this topic and provide a clear explanation.',
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
- **Debugging**: Structured troubleshooting prompts

## Learn More

For more details and advanced patterns, visit the official documentation:
- Full prompts reference: https://mcp-toolkit.nuxt.dev/raw/core-concepts/prompts.md
- Real-world examples: https://mcp-toolkit.nuxt.dev/raw/examples/prompt-examples.md`,
          },
        },
      ],
    }
  },
})
