# Troubleshooting — 1.0

## Migrate to 1.0

Nuxt MCP Toolkit 1.0 uses `nitro-mcp-toolkit` and h3-mcp for protocol handling. Nuxt supplies discovery, layers, auto-imports, and development tooling. Requires Nuxt 4.6 or later.

## Schemas and callbacks

Wrap raw Zod shapes with `z.object(...)`. Any complete Standard Schema library is supported. With an input schema, callbacks receive `(args, event)`; without one, they receive `event`.

```diff
-inputSchema: { id: z.string() },
-handler: (args, extra) => ...,
+inputSchema: z.object({ id: z.string() }),
+handler: (args, event) => ...,
```

`event.context.mcp` exposes protocol context, request cancellation, progress, and logging. Broadcast catalog changes with `event.context.mcp.notifier.toolsChanged()`; `notify` remains the engine's request notification function. Read identity from verified request context rather than capturing it in a shared definition.

A tool with `outputSchema` returns its schema data directly. Use `toolResult(...)` for an explicit protocol envelope, including an `isError` result. Plain objects always mean schema data when an output schema is present.

## Endpoints

Replace `defineMcpHandler` configuration files with named servers:

```ts
mcp: {
  servers: {
    default: { dir: 'mcp' },
    admin: { dir: 'mcp-admin', route: '/mcp/admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
  },
}
```

Move `server/mcp/handlers/admin/{tools,resources,prompts}` into `server/mcp-admin/{tools,resources,prompts}`. Remove the old `index.ts` handler configuration files. Every endpoint discovers only its own roots; `defaultHandlerStrategy` and global handler-attribution filters are removed.

For live callbacks, export `createMcpHandler(...)` from a normal Nuxt route and import explicitly named shared definitions. Native Nuxt middleware runs before the engine and its context reaches definitions.

## Resources and prompts

Use `uriTemplate` instead of an SDK `ResourceTemplate`. Template `list` returns descriptors directly. Resource `mimeType`, `icons`, and `_meta` are top-level fields. Replace the `file` shorthand with an explicit URI and handler or a Nitro server asset.

Prompt strings become user messages. Return an explicit `messages` result for an assistant role. Replace `completable()` with an `arguments` entry carrying a completion callback.

## Authorization and catalogs

`enabled(event)` is removed. Put sensitive catalogs on separately authenticated endpoints. Use verified OAuth claims and definition `scopes` to authorize invocation, enumeration, and completion. Static metadata stays listed when only scopes are required.

Import a generated server from `nitro-mcp-toolkit/servers` and read its `definitions` array. Filter summaries with ordinary array operations. The `listMcp*` and `getMcp*` query helpers are removed. `X-MCP-Tools` still narrows a client's tool selection and never grants access.

## State and client compatibility

Use `session: true` for legacy engine sessions. Modern clients use request context and continuations. Store durable application state by verified user or tenant identity, independently of a particular MCP connection. The old session-storage helpers are removed.

The default `era: 'dual'` supports modern and 2025 Streamable HTTP clients. Ordinary tools, resources, and prompts work in both modes. Input-required continuations require modern capabilities; expose ordinary arguments or instructions for older clients. Do not assume every client supports interactive requests.

The toolkit delegates continuation helpers to h3-mcp. Use `defineRequestState` for signed state, validate resumed input, and reauthorize the operation. Signed state is visible to its holder and is not automatically single-use.

## Removed runtime helpers

- Code Mode and `experimental_codeMode`; remove `secure-exec` when no other feature needs it.
- `useMcpServer`, `getSdkServer`, direct SDK registration, and SDK callback-extra types.
- `useMcpSession` and `invalidateMcpSession`; use explicit application storage.
- `useMcpElicitation`; use the engine's input-request helpers with capability checks.
- `useMcpLogger`; use `event.context.mcp.log` for client logging and an application logger for server diagnostics.
- `mcp:server:created`, `mcp:config:resolved`, and `mcp:definitions:paths`.
- Per-definition `cache: '5m'`; cache application services with Nitro utilities.

`mcp:tool:called` remains available for configured endpoints. A listener error reaches the caller. Protocol Logging is deprecated; keep server diagnostics in application logging. For general input documentation, use schema examples. `_meta.inputExamples` is a custom client convention, and the beta does not currently expose the old typed top-level helper. See [tool examples](tools.md).

## Beta scope

Built-in MCP Apps are deferred. Move server-side App logic into regular tools.

## Configuration

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    name: 'My server',
    version: '1.0.0',
    description: 'Read and update projects.',
    instructions: 'Read a project before changing it.',
    route: '/mcp',
    dir: 'mcp',
    autoImports: true,
    era: 'dual',
    origin: { allow: ['https://app.example.com'] },
  },
})
```

`dir` is relative to each Nuxt layer's server directory. The main app overrides the same relative file in an extended layer. `dir` can also be an array; earlier directories take priority. Duplicate advertised names or resource URIs are errors.

`era: 'dual'` serves modern and legacy clients. `era: 'modern'` accepts only the modern revision. `session` enables legacy protocol sessions; modern requests use request-scoped context and continuations. `logging` advertises MCP logging, independently of your application's server logger.

Use `auth` for static tokens or `oauth` for JWT resource-server verification. [Authentication](/examples/authentication) describes both.

```ts
mcp: {
  name: 'Projects',
  servers: {
    default: {},
    admin: { dir: 'mcp-admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
  },
}
```

The keys identify endpoints: `default` uses `/mcp`, and `admin` uses `/mcp/admin`. Each can override `route` and other server options. Supplying `servers` defines the complete configured set.

Other Nuxt options are `enabled`, `autoImports`, `inspector.headers`, and `llms`. Built-in MCP Apps configuration is removed.

## Caching checklist

Keep `outputSchema` on cached tools. Wrap application work with Nitro `defineCachedFunction` outside the handler, use seconds for `maxAge`, and set `swr` explicitly. Check the default argument key covers every result-selection value, including verified identity for private results, and keep authorization outside the cached function. Choose the import and storage/lifecycle API for the installed Nitro version. MCP client cache hints do not cache server execution. See [complete examples](tools.md).
