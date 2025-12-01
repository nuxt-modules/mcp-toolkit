import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Guide for creating a new MCP resource with best practices',
  inputSchema: {
    resourceName: z.string().describe('Name of the resource to create (kebab-case)'),
    resourceType: z.enum(['file', 'api', 'database', 'dynamic']).describe('Type of resource'),
  },
  handler: async ({ resourceName, resourceType }) => {
    const templates: Record<string, string> = {
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
            text: `Create an MCP resource named "${resourceName}" of type "${resourceType}".

## File Location

Create the file at: \`server/mcp/resources/${resourceName}.ts\`

## Resource Template (${resourceType})

\`\`\`typescript
${templates[resourceType]}
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
5. **Use URI templates for collections**: When you have multiple related items`,
          },
        },
      ],
    }
  },
})
