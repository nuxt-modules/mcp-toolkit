import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating a new MCP tool with best practices',
  inputSchema: {
    toolName: z.string().describe('Name of the tool to create (kebab-case)'),
    toolDescription: z.string().describe('What the tool does'),
  },
  handler: async ({ toolName, toolDescription }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an expert developer helping to create MCP tools using the Nuxt MCP Toolkit.

## Documentation

- **Official Documentation**: https://mcp-toolkit.nuxt.dev/
- **Tools Guide**: https://mcp-toolkit.nuxt.dev/raw/core-concepts/tools.md
- **API Integration Examples**: https://mcp-toolkit.nuxt.dev/raw/examples/api-integration.md
- **Common Patterns**: https://mcp-toolkit.nuxt.dev/raw/examples/common-patterns.md

**IMPORTANT**: Before generating code, always:
1. Proofread and fix any spelling or grammar mistakes in the provided name and description
2. Use consistent naming conventions (kebab-case for filenames, camelCase for variables)
3. Ensure descriptions are clear, professional, and grammatically correct
4. Convert the corrected description to proper English if needed

---

Create an MCP tool named "${toolName}" that ${toolDescription}.

## File Location

Create the file at: \`server/mcp/tools/${toolName}.ts\`

## Tool Template

\`\`\`typescript
import { z } from 'zod'

export default defineMcpTool({
  // name and title are auto-generated from filename
  // name: '${toolName}',
  // title: '${toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}',
  description: '${toolDescription}',
  inputSchema: {
    // Define input parameters with Zod
    // Always use .describe() for better AI understanding
    param1: z.string().describe('Description of param1'),
    param2: z.number().optional().describe('Optional numeric parameter'),
  },
  // Optional: Define output schema for structured responses
  outputSchema: {
    result: z.string(),
    success: z.boolean(),
  },
  handler: async ({ param1, param2 }) => {
    // Implement your tool logic here

    // Return text content
    return {
      content: [{
        type: 'text',
        text: 'Tool result here',
      }],
      // Optional: structured content matching outputSchema
      structuredContent: {
        result: 'value',
        success: true,
      },
    }
  },
})
\`\`\`

## Best Practices

1. **Naming**: Use kebab-case for filenames, the name/title will be auto-generated
2. **Description**: Write clear, action-oriented descriptions
3. **Input Schema**: Use Zod with \`.describe()\` for every parameter
4. **Error Handling**: Return \`isError: true\` for errors:

\`\`\`typescript
if (errorCondition) {
  return {
    content: [{ type: 'text', text: 'Error message' }],
    isError: true,
  }
}
\`\`\`

5. **Structured Output**: Use \`outputSchema\` and \`structuredContent\` for machine-readable responses
6. **Caching**: Add \`cache: '1h'\` for expensive operations that can be cached

## Common Input Types

\`\`\`typescript
inputSchema: {
  // Required string
  text: z.string().describe('Text input'),

  // Optional with default
  limit: z.number().default(10).describe('Max results'),

  // Enum for fixed options
  format: z.enum(['json', 'xml', 'text']).describe('Output format'),

  // Array
  tags: z.array(z.string()).describe('List of tags'),

  // Boolean
  verbose: z.boolean().default(false).describe('Enable verbose output'),
}
\`\`\`

## Learn More

For more details and advanced patterns, visit the official documentation:
- Full tools reference: https://mcp-toolkit.nuxt.dev/raw/core-concepts/tools.md
- Real-world examples: https://mcp-toolkit.nuxt.dev/raw/examples/common-patterns.md`,
          },
        },
      ],
    }
  },
})
