import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating a new MCP resource with best practices',
  inputSchema: {
    purpose: z.string().describe('What data the resource should provide (e.g., "read the README file", "fetch user data from the API", "get database records")'),
  },
  handler: async ({ purpose }) => {
    const templates = {
      file: `import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  description: 'Read a file from the filesystem',
  uri: 'file:///path/to/file.txt',
  mimeType: 'text/plain',
  handler: async (uri: URL) => {
    const content = await readFile(uri.pathname, 'utf-8')
    return {
      contents: [{
        uri: uri.toString(),
        text: content,
        mimeType: 'text/plain',
      }],
    }
  },
})`,
      api: `export default defineMcpResource({
  description: 'Fetch data from an external API',
  uri: 'api:///endpoint',
  mimeType: 'application/json',
  cache: '5m', // Cache for 5 minutes
  handler: async (uri: URL) => {
    const data = await $fetch('https://api.example.com/data')
    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
      }],
    }
  },
})`,
      database: `export default defineMcpResource({
  description: 'Query data from the database',
  uri: 'db:///table-name',
  mimeType: 'application/json',
  cache: '1m',
  handler: async (uri: URL) => {
    // Using Drizzle ORM example
    const records = await useDrizzle().select().from(table).limit(100)
    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(records, null, 2),
        mimeType: 'application/json',
      }],
    }
  },
})`,
      dynamic: `import { z } from 'zod'

export default defineMcpResource({
  description: 'Dynamic resource with URI template',
  // URI template with {id} placeholder
  uriTemplate: {
    uriTemplate: 'item:///{id}',
    arguments: {
      id: z.string().describe('The item ID to fetch'),
    },
  },
  mimeType: 'application/json',
  handler: async (uri: URL, args) => {
    // args.id contains the resolved template value
    const item = await fetchItem(args.id)
    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(item, null, 2),
        mimeType: 'application/json',
      }],
    }
  },
})`,
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an expert developer helping to create MCP resources using the Nuxt MCP Toolkit.

## Documentation

- **Official Documentation**: https://mcp-toolkit.nuxt.dev/
- **Resources Guide**: https://mcp-toolkit.nuxt.dev/raw/core-concepts/resources.md
- **File Operations Examples**: https://mcp-toolkit.nuxt.dev/raw/examples/file-operations.md

**IMPORTANT**: Before generating code, always:
1. Generate an appropriate resource name in kebab-case based on the purpose
2. Determine the appropriate resource type (file, api, database, or dynamic)
3. Use consistent naming conventions (kebab-case for filenames, camelCase for variables)
4. Ensure descriptions are clear, professional, and grammatically correct
5. Proofread and fix any spelling or grammar mistakes in the provided purpose

---

Create an MCP resource that: ${purpose}

## Instructions

1. First, determine an appropriate resource name in kebab-case based on the purpose
2. Determine the resource type based on the data source:
   - **file**: For filesystem operations
   - **api**: For external API calls
   - **database**: For database queries
   - **dynamic**: For resources with variable URIs (e.g., fetching by ID)
3. Create the file at: \`server/mcp/resources/<resource-name>.ts\`

## Resource Templates

### File Resource
\`\`\`typescript
${templates.file}
\`\`\`

### API Resource
\`\`\`typescript
${templates.api}
\`\`\`

### Database Resource
\`\`\`typescript
${templates.database}
\`\`\`

### Dynamic Resource (URI Template)
\`\`\`typescript
${templates.dynamic}
\`\`\`

## Key Concepts

### Static URI vs URI Template

- **Static URI**: Fixed path like \`file:///README.md\`
- **URI Template**: Dynamic path like \`file:///{path}\` with arguments

### Resource Properties

| Property | Description |
|----------|-------------|
| \`uri\` | Static URI for the resource |
| \`uriTemplate\` | Dynamic URI with placeholders |
| \`mimeType\` | Content type (text/plain, application/json, etc.) |
| \`cache\` | Cache duration ('1m', '5m', '1h', '1d') |
| \`description\` | What the resource provides |

### Return Format

\`\`\`typescript
return {
  contents: [{
    uri: uri.toString(),      // The requested URI
    text: 'content string',   // Text content
    // OR
    blob: 'base64-encoded',   // Binary content
    mimeType: 'text/plain',   // Content type
  }],
}
\`\`\`

## Best Practices

1. **Use descriptive URIs**: \`config:///app\` is better than \`resource:///1\`
2. **Set appropriate mimeType**: Helps AI understand the content format
3. **Enable caching**: Use \`cache\` for expensive operations
4. **Handle errors gracefully**: Return empty contents or throw descriptive errors
5. **Use URI templates for collections**: When you have multiple related items

## Learn More

For more details and advanced patterns, visit the official documentation:
- Full resources reference: https://mcp-toolkit.nuxt.dev/raw/core-concepts/resources.md
- File operations examples: https://mcp-toolkit.nuxt.dev/raw/examples/file-operations.md`,
          },
        },
      ],
    }
  },
})
