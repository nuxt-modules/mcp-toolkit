# Troubleshooting Guide

Detailed solutions for common MCP server issues.

## Auto-Imports Issues

### TypeScript Config

Ensure `.nuxt/types` is included:

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

### IDE Not Recognizing Types

1. Restart TypeScript server in IDE
2. Close and reopen IDE
3. Delete `.nuxt` directory and rebuild

### Multiple Nuxt Instances

If running multiple Nuxt apps, ensure correct workspace:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  typescript: {
    strict: true,
    shim: false,
  },
})
```

## Endpoint Issues

### CORS Errors

If accessing from different origin:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/mcp/**': {
        cors: true,
        headers: {
          'access-control-allow-methods': 'GET,POST',
          'access-control-allow-origin': '*',
        },
      },
    },
  },
})
```

### Custom Port

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devServer: {
    port: 3001,
  },
})
```

Then connect to: `http://localhost:3001/mcp`

### Behind Proxy

```typescript
// MCP client config
{
  "url": "https://your-domain.com/mcp"
}
```

## Validation Issues

### Complex Object Validation

```typescript
inputSchema: {
  user: z.object({
    name: z.string().min(2).describe('Name (min 2 chars)'),
    email: z.string().email().describe('Valid email'),
    age: z.number().min(18).optional().describe('Age (18+)'),
  }).describe('User information'),
}
```

### Array Validation

```typescript
inputSchema: {
  tags: z.array(z.string())
    .min(1, 'At least one tag required')
    .max(10, 'Maximum 10 tags')
    .describe('Tags list'),
}
```

### Custom Validation

```typescript
inputSchema: {
  password: z.string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number')
    .describe('Strong password'),
}
```

## Performance Issues

### Slow Tool Responses

Add caching:

```typescript
export default defineMcpTool({
  cache: '5m',
  handler: async () => {
    // expensive operation
  },
})
```

### Large Resource Payloads

Implement pagination:

```typescript
export default defineMcpResource({
  uriTemplate: {
    uriTemplate: 'items:///{page}',
    arguments: {
      page: z.number().default(1).describe('Page number'),
    },
  },
  handler: async (uri, args) => {
    const items = await fetchItems({
      page: args.page,
      limit: 50,
    })
    return { contents: [{ uri: uri.toString(), text: JSON.stringify(items) }] }
  },
})
```

## Discovery Issues

### Files Not Being Discovered

Check file structure:

```bash
# Correct
server/mcp/tools/my-tool.ts

# Incorrect
server/tools/my-tool.ts  # Wrong directory
server/mcp/my-tool.ts    # Missing tools subdirectory
```

### Named Exports Not Working

```typescript
// ❌ Wrong - named export
export const myTool = defineMcpTool({ ... })

// ✅ Correct - default export
export default defineMcpTool({ ... })
```

### Module Not Loading

Check module order in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/mcp-toolkit',  // Should be early in the list
    // other modules...
  ],
})
```
