# Resource Examples

Detailed examples for creating MCP resources.

## Package.json Resource

```typescript
import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  description: 'Read package.json contents',
  uri: 'file:///package.json',
  mimeType: 'application/json',
  handler: async (uri: URL) => {
    const content = await readFile('package.json', 'utf-8')
    return {
      contents: [{
        uri: uri.toString(),
        text: content,
        mimeType: 'application/json',
      }],
    }
  },
})
```

## Environment Config Resource

```typescript
export default defineMcpResource({
  description: 'Get application configuration',
  uri: 'config:///app',
  mimeType: 'application/json',
  handler: async (uri: URL) => {
    const config = {
      environment: process.env.NODE_ENV,
      apiUrl: process.env.API_URL,
      features: {
        darkMode: true,
        analytics: false,
      },
    }
    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(config, null, 2),
        mimeType: 'application/json',
      }],
    }
  },
})
```

## Database Resource

```typescript
export default defineMcpResource({
  description: 'Query users from database',
  uri: 'db:///users',
  mimeType: 'application/json',
  cache: '1m',
  handler: async (uri: URL) => {
    const users = await useDrizzle()
      .select()
      .from(usersTable)
      .limit(100)

    return {
      contents: [{
        uri: uri.toString(),
        text: JSON.stringify(users, null, 2),
        mimeType: 'application/json',
      }],
    }
  },
})
```

## Dynamic File Resource

```typescript
import { z } from 'zod'
import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  description: 'Read any file from docs directory',
  uriTemplate: {
    uriTemplate: 'docs:///{filename}',
    arguments: {
      filename: z.string().describe('Filename in docs directory'),
    },
  },
  mimeType: 'text/markdown',
  handler: async (uri: URL, args) => {
    try {
      const content = await readFile(`docs/${args.filename}`, 'utf-8')
      return {
        contents: [{
          uri: uri.toString(),
          text: content,
          mimeType: 'text/markdown',
        }],
      }
    }
    catch (error) {
      return {
        contents: [{
          uri: uri.toString(),
          text: 'Error: File not found',
          mimeType: 'text/plain',
        }],
      }
    }
  },
})
```
