# nitro-mcp-toolkit

## 0.3.0

### Minor Changes

- [`90cbf89`](https://github.com/nuxt-modules/mcp-toolkit/commit/90cbf8906be41d5a49b04dbde3c8b8eb78ca2538) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `defineMcpPlugins`, so `server/mcp/plugins.ts` is typechecked without a type annotation

  The plugins file is imported only by the generated handler, which is not typechecked with your app. Wrapping its default export replaces the `satisfies ExtensionPlugin[]` the convention used to need, and reports a misspelled `id` or hook where you wrote it:

  ```ts
  // server/mcp/plugins.ts
  import { mcpTasks } from "h3-mcp/tasks";
  import { defineMcpPlugins } from "nitro-mcp-toolkit";

  export default defineMcpPlugins([mcpTasks({ max: 100 })]);
  ```

  The previous form keeps working — the helper returns the array unchanged, and `ExtensionPlugin` is still exported.

- [#334](https://github.com/nuxt-modules/mcp-toolkit/pull/334) [`bd07588`](https://github.com/nuxt-modules/mcp-toolkit/commit/bd075887606eb06e166971b8e46e9fccf358423c) Thanks [@HugoRCD](https://github.com/HugoRCD)! - `defineMcpTool`, `defineMcpResource` and `defineMcpPrompt` take `scopes`. A call is refused unless the verified access token carries every scope listed, read from `scope` (space-delimited) or `scp` (string or array). A refusal is a JSON-RPC `-32003` naming the missing scopes — under HTTP 403 on the modern revision, in the `200` stream a legacy request gets for every error — and it fails closed: scopes on an endpoint with no OAuth refuse every call.

  ```ts
  export default defineMcpTool({
    scopes: ["todos:write"],
    inputSchema: z.object({ id: z.string() }),
    handler: ({ id }) => remove(id),
  });
  ```

  A scoped definition is still listed, with its scopes in `_meta` and in `handler.definitions`; only the call is gated. Options resolve before a request is authenticated, so nothing that builds a listing has seen the token — use a separate endpoint when a tool's existence is itself sensitive.

- [#323](https://github.com/nuxt-modules/mcp-toolkit/pull/323) [`936679e`](https://github.com/nuxt-modules/mcp-toolkit/commit/936679eb8cf70a139c2a04f805531f2ff40bc87e) Thanks [@HugoRCD](https://github.com/HugoRCD)! - The runtime is now [h3-mcp](https://mcp.h3.dev) 0.2.0. `defineMcp*` still wrap plain returns and turn a throw into `isError`; transport, eras, auth, origin, MRTR, and subscriptions come from the engine.

  This is a breaking change on 0.x:

  - `ResourceTemplate` / `completable` are gone. A template is `uriTemplate` plus optional `list` / `complete`; prompt completions live on `arguments`.
  - `inputRequired` / `mcpElicit` / `getElicitedContent` / `defineRequestState` replace `inputResponse` / `acceptedContent`.
  - `legacy` / `responseMode` become `era` (`dual` is the default, `modern` is 2026-07-28 only).
  - `event.context.mcp.mcpReq` / `auth` are gone. Read `inputResponses`, `requestState`, `signal`, and `era` off the engine context.
  - `handler.fetch(req, { authInfo })` is gone; send `Authorization` or `x-api-key`.
  - `handler.bus` / `handler.close` are gone. `handler.notify` still fans out to every listener.
  - Cloudflare no longer needs `nodejs_compat`.
  - An `X-MCP-Tools` header naming an unknown tool is a 400 only after origin and auth have passed, so the name does not leak to a caller who is not allowed through.
  - `createMcpHandler` takes h3-mcp's `{ extensionPlugins }` as a second argument, for tasks and MCP Apps.
  - Engine types (`AuthOptions`, `CacheHints`, `CallToolResult`, `Era`, `PluginOptions`, …) keep their h3-mcp names.
  - `getInputResponses` / `getMissingInputs` / `canRequestInput` / `getSupportedInputs` / `McpJsonRpcError` are re-exported so a handler does not need a second import from `h3-mcp`.
  - `nitro` is an optional peer: it is only required for `nitro-mcp-toolkit/module`. `createMcpHandler` needs `h3`.
  - `createMcpTestClient` accepts `{ headers }` so a Bearer token or `X-MCP-Tools` allowlist does not need a custom `fetch` wrap.
  - Import a mounted handler as `{ mcp }` (or `{ adminMcp }` for `/admin/mcp`) from `nitro-mcp-toolkit/servers`. `#mcp/<slug>/handler` is still what Nitro mounts, not what an app imports.

- [#332](https://github.com/nuxt-modules/mcp-toolkit/pull/332) [`b50badb`](https://github.com/nuxt-modules/mcp-toolkit/commit/b50badb6c8e264ac46a8ffdf1ae63e2a3e8cfd22) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Connectors fill in the issuer conventions of three providers, so `oauth` is one call instead of a JWKS URL you looked up by hand. Each returns the same options object `mcp({ oauth })` and `createMcpOAuth` already accept, and each sits on its own subpath — an app that imports none of them never loads them.

  ```ts
  import { clerk } from "nitro-mcp-toolkit/oauth/clerk";

  mcp({ oauth: clerk({ resource: "https://api.example.com/mcp" }) });
  ```

  `clerk` reads `CLERK_PUBLISHABLE_KEY` for the issuer and JWKS, skips audience checks (Clerk puts the OAuth client in `azp`, so use `authorizedParties`), and proxies RFC 8414 metadata from Clerk for clients that only look on the resource origin. `okta` covers custom authorization servers and derives JWKS from the issuer. `workos` covers AuthKit, where `aud` is the client id rather than the MCP URL.

- [#331](https://github.com/nuxt-modules/mcp-toolkit/pull/331) [`6f57222`](https://github.com/nuxt-modules/mcp-toolkit/commit/6f57222a42260019fe1150bac73e79d19029cc23) Thanks [@HugoRCD](https://github.com/HugoRCD)! - `mcp({ oauth })` protects a file-based endpoint without a route file. The module generates the `createMcpOAuth` call, wires it as the handler's `auth`, and mounts the RFC 9728 protected-resource document on the path RFC 9728 derives from `resource` — so a client that gets a `401` can find where to authenticate. `oauth` and `auth` cannot both be set on one endpoint, and a config without a JWKS URL throws at build rather than accepting everything.

  ```ts
  // nitro.config.ts
  export default defineConfig({
    modules: [
      mcp({
        oauth: {
          resource: "https://api.example.com/mcp",
          authorizationServers: ["https://auth.example.com"],
          jwt: { jwks: "https://auth.example.com/.well-known/jwks.json" },
        },
      }),
    ],
  });
  ```

- [#330](https://github.com/nuxt-modules/mcp-toolkit/pull/330) [`0d8a574`](https://github.com/nuxt-modules/mcp-toolkit/commit/0d8a5743ad16ff4a55701445637a79222333e240) Thanks [@HugoRCD](https://github.com/HugoRCD)! - `createMcpOAuth` turns an MCP endpoint into an OAuth 2.1 resource server: JWT access tokens are verified against the issuer's JWKS, and the verified claims land on `event.context.oauth`. `iss` defaults to `authorizationServers` and `aud` to `resource`, so a token minted for another service is refused. It also hands you `metadataHandler` and `metadataPath` for the RFC 9728 protected-resource document, which is what a `401`'s `WWW-Authenticate` points clients at. `createMcpOAuth({ verify })` covers opaque tokens instead. This package does not issue tokens — pair it with an authorization server.

  ```ts
  const oauth = createMcpOAuth({
    resource: "https://api.example.com/mcp",
    authorizationServers: ["https://auth.example.com"],
    jwt: { jwks: "https://auth.example.com/.well-known/jwks.json" },
  });

  export default createMcpHandler({ auth: oauth.auth, tools: [whoami] });
  ```

- [#333](https://github.com/nuxt-modules/mcp-toolkit/pull/333) [`a9acbe6`](https://github.com/nuxt-modules/mcp-toolkit/commit/a9acbe6e2862bbe935e134c820c5dcd7bdb3f198) Thanks [@HugoRCD](https://github.com/HugoRCD)! - `server/mcp/plugins.ts`, beside `tools/`, `resources/` and `prompts/`, installs h3-mcp extension plugins on that endpoint. Its default export is the array, and `ExtensionPlugin` is now re-exported so the file can name the type it satisfies. A plugin is a live function, so this is how one reaches a generated handler — `mcp()` options cross into generated code as JSON. The file belongs to whichever `mcp()` scans its directory, `.js` / `.mts` / `.mjs` work too, creating it in development needs no restart, and each build names the file it installed.

  ```ts
  // server/mcp/plugins.ts
  import { mcpTasks } from "h3-mcp/tasks";
  import type { ExtensionPlugin } from "nitro-mcp-toolkit";

  export default [mcpTasks({ max: 100 })] satisfies ExtensionPlugin[];
  ```

- [#338](https://github.com/nuxt-modules/mcp-toolkit/pull/338) [`6785b95`](https://github.com/nuxt-modules/mcp-toolkit/commit/6785b951a0ca2f8cb45aa8f44e530d8ab150a10a) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Require resource-bound, expiring JWTs. Clerk now checks the MCP resource audience; WorkOS uses an AuthKit issuer (`issuer` or `WORKOS_AUTHKIT_ISSUER`) and Connect resource indicators instead of client-ID session tokens. Disabling generic JWT audience checks requires a custom `verify` callback that validates the resource.

  Apply definition scopes to resource enumeration and completion callbacks and prompt completion. Unauthorized resource enumeration fails the listing before invoking that callback; static metadata remains visible.

  Run plugin setup once and preserve the original event during unknown `X-MCP-Tools` authentication. Use `toolResult()` to return an explicit protocol envelope from a tool with `outputSchema`; plain objects remain schema data.

  Accept the tested Nitro `3.0.260610-beta` peer in addition to stable `3.x`.

### Patch Changes

- [`1a0127a`](https://github.com/nuxt-modules/mcp-toolkit/commit/1a0127a9c0f94fc7bedbf8e77dd4afd183be7705) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Accept readonly definition collections in createMcpHandler and index X-MCP-Tools selections while preserving registration order and request isolation.

- [`6c85cf9`](https://github.com/nuxt-modules/mcp-toolkit/commit/6c85cf9397997697bb2160eff0f0fb69be523a90) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Reuse the most recent `X-MCP-Tools` selection to avoid repeated parsing and sorting. Authentication and scope checks still run for every request.

## 0.2.0

### Minor Changes

- [#311](https://github.com/nuxt-modules/mcp-toolkit/pull/311) [`d623f33`](https://github.com/nuxt-modules/mcp-toolkit/commit/d623f33f830bb7126811db6248ecce5ad1f3f9cf) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Tool, resource and prompt handlers now receive the request's `H3Event` directly instead of a separate context object, with everything MCP-specific attached at `event.context.mcp` — mirroring h3-mcp's event-first shape. This is a breaking change: `context.mcp.raw` moves to `context.mcp.mcpReq`, and anything reading the old context object needs to read off `event.context.mcp` instead.

  Also adds a declarative `auth` gate to `createMcpHandler` (bearer/API-key tokens, a custom `validate` callback, OAuth protected-resource metadata), and its JSON-serializable subset — a static token list — as an `auth` option on `mcp()`.

- [#320](https://github.com/nuxt-modules/mcp-toolkit/pull/320) [`108baa7`](https://github.com/nuxt-modules/mcp-toolkit/commit/108baa7fbfa193302c8db9e6ef052f5e1c5b00cf) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Clients can send an `X-MCP-Tools` header with a comma-separated list of tool names to limit what `tools/list` exposes. Unknown names return HTTP 400. `handler.definitions` stays the full catalog.

## 0.1.0

### Minor Changes

- [#310](https://github.com/nuxt-modules/mcp-toolkit/pull/310) [`8db8e10`](https://github.com/nuxt-modules/mcp-toolkit/commit/8db8e10eb7ca5b99df0e0a5ae2ea6c9a88dc26e1) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Moved off the alpha-only manual release track onto the same changesets flow as `@nuxtjs/mcp-toolkit`: versions and publishes from a PR, ships to the `latest` npm dist-tag. While the package stays pre-1.0, breaking changes are released as `minor` bumps rather than `major`.
