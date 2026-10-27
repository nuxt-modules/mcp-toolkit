# Middleware — 1.0

## Middleware and authentication

Use ordinary Nuxt server middleware for application context. The Nitro 2 adapter carries that context into the shared MCP event.

```ts [server/middleware/mcp-user.ts]
import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  event.context.user = await authenticateRequest(event)
})
```

Use endpoint `oauth` for JWT verification and `scopes` on definitions for operation-level checks. A static `auth.tokens` list protects an entire endpoint. A custom resource verifier belongs in a manually composed route.

`enabled(event)` is removed. Required scopes gate invocation while static metadata remains listed. If even a tool's existence is sensitive, put it on a separately authenticated endpoint. Client-provided headers and arguments are not user identity.

## Authentication

```ts
mcp: {
  servers: {
    default: {},
    admin: { dir: 'mcp-admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
  },
}
```

For OAuth, configure `oauth: { resource, authorizationServers, jwt: { jwks, issuer, audience } }`. Provider connectors are available at `nitro-mcp-toolkit/oauth/clerk`, `/okta`, and `/workos` and return this same configuration. The toolkit verifies access tokens and serves protected-resource metadata; it does not issue tokens.

Put `scopes: ['projects:write']` on a definition to require all listed scopes. Claims come from `event.context.oauth`; absent claims fail closed. Scope checks protect invocation and application completion/enumeration callbacks, while static catalog metadata stays listed.

A custom verifier belongs in `createMcpOAuth({ verify })` and a manually composed route. Enforce verified user and tenant boundaries in application queries. A client-provided role header or tool argument is not authorization.

## Tool call hooks

```ts [server/plugins/mcp-metrics.ts]
export default defineNitroPlugin((app) => {
  app.hooks.hook('mcp:tool:called', ({ name, result, durationMs, event }) => {
    console.log({ name, durationMs, user: event.context.oauth?.sub, result })
  })
})
```

Configured endpoints fire the hook after a tool settles into a result, including application failures converted to `isError`. A listener error reaches the caller; keep observers focused on recording.

Manually composed handlers accept `onToolCall` with the same payload. Use a Nitro 3 plugin's explicit `definePlugin` import in a Nitro 3 app.

`mcp:server:created` and `mcp:config:resolved` are removed with the SDK-server runtime. Compose definitions, endpoint options, and extension plugins directly.

## Logging and progress

Keep server diagnostics in the application logger or tool-call hook. MCP Logging is deprecated; existing engine logging support follows the selected protocol revision, including a per-request log level for modern clients.

```ts
handler: async (args, event) => {
  event.context.mcp.log?.('info', { message: 'Starting' }, 'projects')
  event.context.mcp.progress?.(0, 10, 'Starting')
  return runTask(args, event.context.mcp.signal)
}
```

The engine handles the notification transport on both eras. A plain JSON response has no stream for notifications, so these functions may do nothing when the client did not request a channel. Progress uses the client's token; never invent one.

Use your application logger for server-side logs and the `mcp:tool:called` hook for metrics. The old `useMcpLogger` wrapper is removed. Keep private server diagnostics out of client-visible notifications.
