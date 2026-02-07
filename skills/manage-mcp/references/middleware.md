# Middleware & Handlers Guide

Advanced customization of MCP servers with middleware and handlers.

## Middleware Patterns

### Authentication Middleware

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    const token = event.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return createError({
        statusCode: 401,
        message: 'Authentication required',
      })
    }

    try {
      const user = await verifyToken(token)
      event.context.user = user
      return next()
    }
    catch (error) {
      return createError({
        statusCode: 401,
        message: 'Invalid token',
      })
    }
  },
})
```

### Logging Middleware

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    const start = Date.now()
    const method = event.method
    const path = event.path

    console.log(`[MCP] ${method} ${path}`)

    const result = await next()

    const duration = Date.now() - start
    console.log(`[MCP] ${method} ${path} - ${duration}ms`)

    return result
  },
})
```

### CORS Middleware

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    // Set CORS headers
    event.node.res.setHeader('Access-Control-Allow-Origin', '*')
    event.node.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    event.node.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight
    if (event.method === 'OPTIONS') {
      event.node.res.statusCode = 204
      event.node.res.end()
      return
    }

    return next()
  },
})
```

### Request Validation

```typescript
// server/mcp/middleware.ts
import { z } from 'zod'

const mcpRequestSchema = z.object({
  method: z.string(),
  params: z.any().optional(),
})

export default defineMcpMiddleware({
  handler: async (event, next) => {
    try {
      const body = await readBody(event)
      mcpRequestSchema.parse(body)
      return next()
    }
    catch (error) {
      return createError({
        statusCode: 400,
        message: 'Invalid request format',
      })
    }
  },
})
```

## Custom Handlers

### Multiple MCP Endpoints

```typescript
// server/mcp/handlers/public.ts
export default defineMcpHandler({
  name: 'public-mcp',
  route: '/mcp/public',
  handler: async (event) => {
    return {
      tools: await loadPublicTools(),
      resources: [],
      prompts: [],
    }
  },
})

// server/mcp/handlers/admin.ts
export default defineMcpHandler({
  name: 'admin-mcp',
  route: '/mcp/admin',
  middleware: [checkAdminAuth],
  handler: async (event) => {
    return {
      tools: await loadAdminTools(),
      resources: [],
      prompts: [],
    }
  },
})
```

### Dynamic Tool Loading

```typescript
// server/mcp/handlers/dynamic.ts
export default defineMcpHandler({
  name: 'dynamic-mcp',
  handler: async (event) => {
    const user = event.context.user

    // Load tools based on user permissions
    const tools = await loadToolsForUser(user)

    return {
      tools,
      resources: [],
      prompts: [],
    }
  },
})
```

### Tool Filtering

```typescript
// server/mcp/handlers/filtered.ts
export default defineMcpHandler({
  name: 'filtered-mcp',
  handler: async (event) => {
    const tools = await loadAllTools()

    // Filter based on query params
    const category = event.query.category
    const filteredTools = category
      ? tools.filter(t => t.category === category)
      : tools

    return {
      tools: filteredTools,
      resources: [],
      prompts: [],
    }
  },
})
```

## Advanced Patterns

### Request Context

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    // Add custom context
    event.context.requestId = crypto.randomUUID()
    event.context.startTime = Date.now()
    event.context.user = await getCurrentUser(event)

    return next()
  },
})

// Use in tools
// server/mcp/tools/example.ts
export default defineMcpTool({
  handler: async (params, { event }) => {
    const user = event.context.user
    const requestId = event.context.requestId

    console.log(`[${requestId}] User ${user.id} called tool`)

    return { content: [{ type: 'text', text: 'Done' }] }
  },
})
```

### Error Handling

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    try {
      return await next()
    }
    catch (error) {
      console.error('MCP Error:', error)

      // Log to monitoring service
      await logError(error, {
        path: event.path,
        user: event.context.user,
      })

      return createError({
        statusCode: 500,
        message: 'Internal server error',
      })
    }
  },
})
```

### Caching Strategy

```typescript
// server/mcp/middleware.ts
const cache = new Map()

export default defineMcpMiddleware({
  handler: async (event, next) => {
    const cacheKey = `${event.method}:${event.path}:${JSON.stringify(event.query)}`

    // Check cache
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)
      if (Date.now() - cached.timestamp < 60000) { // 1 minute
        return cached.data
      }
    }

    // Execute and cache
    const result = await next()
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  },
})
```

## Security Best Practices

### API Key Validation

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    const apiKey = event.headers.get('x-api-key')

    // Validate format
    if (!apiKey || !/^[a-zA-Z0-9-]{32,}$/.test(apiKey)) {
      return createError({
        statusCode: 401,
        message: 'Invalid API key format',
      })
    }

    // Check against database
    const isValid = await validateApiKey(apiKey)
    if (!isValid) {
      return createError({
        statusCode: 401,
        message: 'Invalid API key',
      })
    }

    return next()
  },
})
```

### Rate Limiting per User

```typescript
// server/mcp/middleware.ts
const userLimits = new Map()

export default defineMcpMiddleware({
  handler: async (event, next) => {
    const userId = event.context.user?.id
    if (!userId) return next()

    const now = Date.now()
    const window = 60000 // 1 minute
    const limit = 100

    const userRequests = userLimits.get(userId) || []
    const recentRequests = userRequests.filter(t => now - t < window)

    if (recentRequests.length >= limit) {
      return createError({
        statusCode: 429,
        message: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': limit,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': Math.ceil((recentRequests[0] + window) / 1000),
        },
      })
    }

    userLimits.set(userId, [...recentRequests, now])
    return next()
  },
})
```

### Input Sanitization

```typescript
// server/mcp/middleware.ts
export default defineMcpMiddleware({
  handler: async (event, next) => {
    const body = await readBody(event)

    // Sanitize inputs
    if (body.params) {
      body.params = sanitizeObject(body.params)
    }

    // Prevent injection attacks
    if (typeof body.params === 'string' && containsSQLInjection(body.params)) {
      return createError({
        statusCode: 400,
        message: 'Invalid input detected',
      })
    }

    return next()
  },
})
```
