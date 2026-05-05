# @nuxtjs/mcp-toolkit

## 0.16.1

### Patch Changes

- [#246](https://github.com/nuxt-modules/mcp-toolkit/pull/246) [`a918138`](https://github.com/nuxt-modules/mcp-toolkit/commit/a9181385dece334957d81fe353a1db03df8d8fed) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Default `swr` to `false` for cached tools and resources. Nitro's underlying default (`swr: true`) returned stale entries immediately and refreshed the handler in a background task that ran after the MCP request had been answered, silently dropping any request-scoped writes (e.g. `useLogger(event).set()`). Pass `cache: { maxAge: '1h', swr: true }` to opt back in.

## 0.16.0

### Minor Changes

- [#241](https://github.com/nuxt-modules/mcp-toolkit/pull/241) [`1833fa6`](https://github.com/nuxt-modules/mcp-toolkit/commit/1833fa6094a59285bd3829cca64395618b8e72c7) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Defer evlog setup to `evlog/nuxt`, and auto-tag MCP wide events with sensible defaults.

  The toolkit no longer registers an evlog Nitro module — install `evlog`, add `'evlog/nuxt'` to `modules`, and configure observability from the top-level `evlog: { … }` key in `nuxt.config.ts`. In return, the integration gets dramatically more value out-of-the-box:

  - **Auto `service` for MCP traffic.** When `evlog/nuxt` is registered, the toolkit injects `evlog.routes['/mcp/**'] = { service: '<evlog.env.service>/mcp' }` (or slugified `mcp.name`) unless you've pinned the route yourself.
  - **Auto `user.*` / `session.*` tagging.** After your MCP middleware runs, the toolkit reads `event.context.user` (`id`, `email`, `name`), `event.context.userId`, and `event.context.session.id` and tags the wide event with the canonical schema every drain understands. Works with better-auth, custom API key handlers, anything that follows the Nuxt context convention.
  - **`setUser` / `setSession` helpers** on `useMcpLogger()` for tools that want to enrich beyond what middleware sets.

  ### Migration

  ```ts
  // Before
  export default defineNuxtConfig({
    modules: ["@nuxtjs/mcp-toolkit"],
    mcp: {
      logging: {
        env: { service: "my-app" },
        sampling: { rates: { info: 30 } },
      },
    },
  });

  // After
  export default defineNuxtConfig({
    modules: ["evlog/nuxt", "@nuxtjs/mcp-toolkit"],
    evlog: {
      env: { service: "my-app" },
      sampling: { rates: { info: 30 } },
      // No need to pin `routes['/mcp/**']` — auto-tagged with `my-app/mcp`.
    },
  });
  ```

  ### `mcp.logging` modes

  | Value                 | Behavior                                                      |
  | --------------------- | ------------------------------------------------------------- |
  | `undefined` (default) | On if `evlog/nuxt` is registered, off otherwise.              |
  | `true`                | Asserts `evlog/nuxt` is registered. Build throws if it isn't. |
  | `false`               | Opt out. `log.notify(...)` keeps working.                     |

  The object form of `mcp.logging` is removed — pass options under the top-level `evlog: { … }` key instead.

- [#238](https://github.com/nuxt-modules/mcp-toolkit/pull/238) [`2258de8`](https://github.com/nuxt-modules/mcp-toolkit/commit/2258de8be03433d396d31eb444fe52a35352714f) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `listMcpTools`, `listMcpResources`, `listMcpPrompts`, and `listMcpDefinitions` helpers to read the toolkit's discovered tools, resources, and prompts from your own server routes — without duplicating their names and descriptions.

  ### Usage

  ```ts
  // server/routes/.well-known/mcp/server-card.json.get.ts
  import { listMcpDefinitions } from "@nuxtjs/mcp-toolkit/server";

  export default defineEventHandler(async (event) => {
    const { tools, resources, prompts } = await listMcpDefinitions({ event });
    return {
      name: "My MCP Server",
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
      resources: resources.map((r) => ({
        name: r.name,
        uri: r.uri,
        description: r.description,
      })),
      prompts: prompts.map((p) => ({
        name: p.name,
        description: p.description,
      })),
    };
  });
  ```

  Each helper returns JSON-friendly summaries (`name`, `title`, `description`, `group`, `tags` — plus `uri` for resources). Names auto-generated from filenames are already resolved, so what you get matches exactly what an MCP client sees in `tools/list`.

  ### Filtering

  Every helper accepts a `ListMcpDefinitionsOptions` object — filters compose with AND semantics:

  - `event` — apply per-definition `enabled()` guards using the request context.
  - `group` (`string | string[]`) — only include definitions in one of these groups (OR-match).
  - `tags` (`string | string[]`) — only include definitions with at least one of these tags (OR-match).

  ```ts
  const adminDestructive = await listMcpTools({
    event,
    group: "admin",
    tags: "destructive",
  });
  ```

  The new helpers are also auto-imported on the server (when `autoImports` is enabled), so you can use them without importing.

- [#240](https://github.com/nuxt-modules/mcp-toolkit/pull/240) [`4b00084`](https://github.com/nuxt-modules/mcp-toolkit/commit/4b00084ec8da8f839db6260750f487b4a3d86eba) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add multi-handler organization: every auto-discovered tool, resource, or prompt can now be attributed to a named handler without manual filtering. One folder convention, one function-based escape hatch.

  ### Folder convention (the way to attribute)

  Drop a definition under `server/mcp/handlers/<name>/{tools,resources,prompts}/` and it's auto-attached to the named handler `<name>` (mounted at `/mcp/<name>`). The handler `index.ts` is required, even as a one-liner — it's what registers the route:

  ```
  server/mcp/handlers/admin/
  ├── index.ts              # export default defineMcpHandler({ middleware: requireAdmin })
  ├── tools/delete-user.ts  # → /mcp/admin (auto)
  └── prompts/help.ts       # → /mcp/admin (auto)
  ```

  ### `getMcp*` raw helpers (the escape hatch)

  For cross-cutting cases — "every tool tagged X", "every orphan", "everything except this group" — pass a function that calls one of the new raw helpers. They return full definition objects (with handlers and Zod schemas), exactly what `defineMcpHandler` expects:

  ```ts
  import { defineMcpHandler, getMcpTools } from "@nuxtjs/mcp-toolkit/server";

  export default defineMcpHandler({
    tools: (event) => getMcpTools({ event, tags: ["searchable"] }),
  });
  ```

  `getMcpTools`, `getMcpResources`, and `getMcpPrompts` accept the same options as `listMcp*`.

  ### Default handler strategy

  New `mcp.defaultHandlerStrategy` config (default `'orphans'`) controls which definitions land on `/mcp` when named handlers exist. With `'orphans'`, each definition shows up in exactly one place. Set to `'all'` to keep the pre-multi-handler behaviour.

  ### `listMcp*` filters + summary `handler`

  The listing helpers gain two new options:

  - `handler` (`string | string[]`) — keep only definitions attributed to one of these named handlers.
  - `orphansOnly` (`boolean`) — keep only orphan definitions.

  Each summary now exposes a `handler?: string` field with the attributed handler name (or undefined for orphans).

  ### Back-compat

  100% additive when you don't use the new convention — apps without `server/mcp/handlers/` see no behaviour change. Top-level handler files (`server/mcp/<name>.ts`) keep their pre-feature behaviour: when `tools` is omitted, the full pool is exposed (so code-mode-style wrappers continue to work without any change). Existing `tools: [...]` and `tools: ev => ...` patterns also keep working.

  ```ts
  // Before — manual filtering
  export default defineMcpHandler({
    name: "apps",
    tools: allTools.filter((t) => t._meta?.group === "apps"),
  });

  // After — folder convention (move to server/mcp/handlers/apps/, drop the filter)
  export default defineMcpHandler({
    description: "Apps handler",
  });
  ```

  See [`/handlers/organization`](https://mcp-toolkit.nuxt.dev/handlers/organization) for the full guide.

## 0.15.0

### Minor Changes

- [#229](https://github.com/nuxt-modules/mcp-toolkit/pull/229) [`7c07d28`](https://github.com/nuxt-modules/mcp-toolkit/commit/7c07d2884eb202bd8f19c570895776d9c3912891) Thanks [@HugoRCD](https://github.com/HugoRCD)! - **MCP Apps** — author interactive UI widgets as Vue Single-File Components and ship them to MCP Apps-compatible hosts such as Cursor and ChatGPT.

  ### Authoring

  Drop a `.vue` file in `app/mcp/`, declare the tool with `defineMcpApp`, and the toolkit takes care of the rest:

  ```vue
  <script setup lang="ts">
  import { z } from "zod";

  defineMcpApp({
    description: "Pick a colour and preview a palette.",
    inputSchema: { base: z.string().describe("Hex colour, e.g. #2563eb") },
    handler: async ({ base }) => ({
      structuredContent: await $fetch("/api/palette", { query: { base } }),
    }),
  });

  const { data, sendPrompt } = useMcpApp();
  </script>

  <template>
    <button
      v-for="s in data?.swatches"
      :key="s.hex"
      @click="sendPrompt(`Use ${s.name}`)"
    >
      {{ s.name }}
    </button>
  </template>
  ```

  Each SFC becomes:

  - a `defineMcpTool`-style tool registered on the handler,
  - a `text/html;profile=mcp-app` UI resource at `ui://mcp-app/<name>`,
  - a single-file HTML bundle (Vue runtime + your code + scoped CSS) served inline.

  The handler runs server-side and returns `structuredContent`, which is inlined into the bundled HTML so the iframe boots **with full data on the first paint** — no extra round-trip, no flicker.

  ### Single client-side composable

  `useMcpApp<T>()` is auto-imported into every `app/mcp/*.vue` SFC and exposes the full surface:

  - `data`, `loading`, `error`, `pending` — reactive state.
  - `hostContext` — theme, display mode, container size, locale, time zone, platform.
  - `callTool(name, params)` — re-invoke any MCP tool and refresh `data` in place.
  - `sendPrompt(prompt)` — push a follow-up into the chat to trigger another tool/app.
  - `openLink(url)` — ask the host to open a URL outside the iframe sandbox.

  The host bridge transparently negotiates between modern JSON-RPC, the legacy `mcp-ui` envelope, and the ChatGPT Apps SDK globals.

  ### Security defaults

  Every app HTML ships with a strict Content Security Policy. Allow external assets per app via:

  ```ts
  defineMcpApp({
    csp: {
      resourceDomains: ["https://images.example.com"], // <img>, <style>, fonts
      connectDomains: ["https://api.example.com"], // fetch / XHR / WebSocket
    },
  });
  ```

  CSP origins are validated at build time (only `http(s)://` / `ws(s)://`, no path/query/quote characters), and the same allow-list is mirrored into `_meta.ui.csp` and `_meta['openai/widgetCSP']` for hosts that enforce CSP themselves.

  ### Tree-shakable

  The MCP Apps pipeline is fully optional: when no `app/mcp/` directory exists, none of the runtime, the macro, or the auto-imports are emitted.

  ### Docs

  - [Apps guide](https://mcp-toolkit.nuxt.dev/apps/overview) — full authoring walkthrough, host context, follow-ups, host compatibility matrix.
  - [MCP Apps internals](https://mcp-toolkit.nuxt.dev/advanced/mcp-apps-internals) — build pipeline, host bridge protocol, security model, advanced patterns.

## 0.14.0

### Minor Changes

- [#226](https://github.com/nuxt-modules/mcp-toolkit/pull/226) [`2dd1e29`](https://github.com/nuxt-modules/mcp-toolkit/commit/2dd1e29ae5915d962508957d7a21740704ad6d04) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `useMcpElicitation()` for requesting structured input from the connected client (MCP spec 2025-11-25).

  ```typescript
  const elicit = useMcpElicitation();

  const result = await elicit.form({
    message: "Pick a release channel",
    schema: { channel: z.enum(["stable", "beta"]) },
  });
  if (result.action !== "accept") return "Cancelled.";
  ```

  - **Form mode** — pass a Zod raw shape; the response is validated and fully typed.
  - **URL mode** — `elicit.url({ message, url })` redirects the user to a hosted page (opt-in per the spec).
  - **Confirm** — `elicit.confirm(message)` returns a `boolean`.
  - **Capability check** — `elicit.supports('form' | 'url')` follows the spec's backwards compatibility rule (an empty `elicitation: {}` capability defaults to form support; once `url` is declared explicitly, `form` must be too).
  - **Typed errors** — `McpElicitationError` with `code: 'unsupported' | 'invalid-schema' | 'invalid-response'` so callers can fall back gracefully when the client doesn't support the prompt.
  - Underlying validation: Zod → JSON Schema (per the MCP spec, the schema must be a flat object of primitives, enums, or string-enum arrays — nested objects are rejected up front).

  The composable is auto-imported alongside the existing helpers and re-exported from `@nuxtjs/mcp-toolkit/server`. The toolkit also re-exports `useMcpServer()` and `useMcpSession()` from the same entry point.

  Also bumps the DevTools MCP Inspector launch budget to 60s with a fast-path that resolves as soon as the inspector emits its ready URL with the captured `MCP_PROXY_AUTH_TOKEN`, so the Inspector tab no longer times out on a cold `npx` install when testing elicitation.

- [#227](https://github.com/nuxt-modules/mcp-toolkit/pull/227) [`6ca0c23`](https://github.com/nuxt-modules/mcp-toolkit/commit/6ca0c23f7b077b6c5af7f862f63ffa5bdee5f87b) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `useMcpLogger()` and first-class observability via [evlog](https://evlog.dev), shipped as an **optional peer dependency**.

  The composable is split into two clearly-named channels so it's always obvious what reaches the user vs. your server logs:

  ```typescript
  const log = useMcpLogger("billing");

  // → MCP client (Inspector / Cursor / Claude — notifications/message). Always works.
  await log.notify.info({ msg: "starting charge", amount });

  // → server-side wide event (dev terminal + drains). Requires `evlog` installed.
  log.set({ user: { id: userId } });
  log.event("charge_started", { amount });
  ```

  - **Client channel** — `log.notify(level, data, logger?)` plus `notify.debug` / `notify.info` / `notify.warning` / `notify.error` shortcuts. Always resolves, never throws, and respects the client's `logging/setLevel` per session. The toolkit declares the `logging` server capability automatically. Works without `evlog`.
  - **Server channel** — `log.set(fields)` accumulates context onto the request's evlog wide event; `log.event(name, fields?)` captures a discrete event; `log.evlog` exposes the full [`RequestLogger`](https://evlog.dev/docs/api/request-logger) (`fork`, `error`, `getContext`, …). Throws `McpObservabilityNotEnabledError` when observability is off.

  ### Opt-in observability

  `evlog` is an **optional peer dependency** — install it to unlock wide events:

  ```bash
  pnpm add evlog
  ```

  `mcp.logging` modes:

  | Value             | Behavior                                                                                              |
  | ----------------- | ----------------------------------------------------------------------------------------------------- |
  | omitted (default) | Auto-detect: on if `evlog` is installed, off otherwise.                                               |
  | `true` or object  | Force on. Build throws with install instructions if `evlog` is missing.                               |
  | `false`           | Force off. `notify` keeps working; `set` / `event` / `evlog` throw `McpObservabilityNotEnabledError`. |

  ### Native MCP wide-event tagging

  When observability is active, every MCP request is wrapped in an evlog wide event natively tagged with the JSON-RPC payload — no user code required:

  | Field                                      | Description                                                |
  | ------------------------------------------ | ---------------------------------------------------------- |
  | `mcp.transport`                            | `streamable-http` / `cloudflare-do`                        |
  | `mcp.route`                                | The configured MCP endpoint path                           |
  | `mcp.session_id`                           | From the `mcp-session-id` header                           |
  | `mcp.method`                               | `tools/call`, `tools/list`, `initialize`, …                |
  | `mcp.request_id`                           | The JSON-RPC id                                            |
  | `mcp.tool` / `mcp.resource` / `mcp.prompt` | Filled per `tools/call` / `resources/read` / `prompts/get` |

  Batched JSON-RPC payloads expose plural arrays (`mcp.methods`, `mcp.tools`, …).

  ### Ship to your observability stack

  Once `evlog` is installed, every MCP wide event can be forwarded to **Axiom, Sentry, OTLP, HyperDX, Datadog, Better Stack, or PostHog** with a single Nitro plugin — no MCP-specific glue, just the standard `evlog:drain` hook:

  ```typescript
  // server/plugins/evlog-axiom.ts
  import { createAxiomDrain } from "evlog/adapters/axiom";

  export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook("evlog:drain", createAxiomDrain());
  });
  ```

  Register multiple drains in parallel, or write a custom one with `(ctx) => Promise<void>`. See [evlog.dev](https://evlog.dev) for the full list.

  ### Compatibility

  When wired in, the integration plays nicely with `@nuxthub/core` and other modules that pull in CLI dependencies (e.g. `drizzle-kit`) — we no longer force `noExternals: true` globally; instead we inline only `evlog` and `evlog/nitro`.

### Patch Changes

- [#221](https://github.com/nuxt-modules/mcp-toolkit/pull/221) [`84bdb8e`](https://github.com/nuxt-modules/mcp-toolkit/commit/84bdb8e3ec54c01312233b6c808e3e79207e5ba8) Thanks [@benjamincanac](https://github.com/benjamincanac)! - Reject GET SSE requests in stateless mode to prevent serverless functions from hitting execution timeouts

- [#228](https://github.com/nuxt-modules/mcp-toolkit/pull/228) [`756985b`](https://github.com/nuxt-modules/mcp-toolkit/commit/756985ba2987d8aa288ec4ed3fd0727b14d9f249) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Internal refactor: tighten TypeScript across the module and split `module.ts` into focused setup helpers (`evlog`, `nitro-aliases`, `definitions`, `auto-imports`). Removes the remaining `as any` casts in `server.ts`, `logger.ts`, `elicitation.ts`, `utils.ts`, `compat.ts`, `executor.ts` and `handler.ts`, centralises virtual-module declarations under `runtime/types/virtual-modules.d.ts`, and adds an ambient type surface for the optional `secure-exec` peer dep. No public API changes.

## 0.13.4

### Patch Changes

- [#214](https://github.com/nuxt-modules/mcp-toolkit/pull/214) [`576b87d`](https://github.com/nuxt-modules/mcp-toolkit/commit/576b87d9fdb55647e98420e81c68dc48432542da) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `audioResult()` helper (and server auto-import) for tool handlers returning MCP audio content (base64 + MIME type), mirroring `imageResult`.

- [`6a6227c`](https://github.com/nuxt-modules/mcp-toolkit/commit/6a6227cfa17f6479277bba47afaf2ea0c8110191) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Fix file path generation on Windows producing backslashes instead of forward slashes.

- [`6a6227c`](https://github.com/nuxt-modules/mcp-toolkit/commit/6a6227cfa17f6479277bba47afaf2ea0c8110191) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Harden code-mode executor with resource limits (memory, timeout, call-depth), per-execution `AsyncLocalStorage` context, and concurrency safety via a semaphore that caps parallel sandbox runs.

- [`6a6227c`](https://github.com/nuxt-modules/mcp-toolkit/commit/6a6227cfa17f6479277bba47afaf2ea0c8110191) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Prefer `structuredContent` over raw `content` when dispatching code-mode tool results, preserving typed return values for the caller.

- [`6a6227c`](https://github.com/nuxt-modules/mcp-toolkit/commit/6a6227cfa17f6479277bba47afaf2ea0c8110191) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Surface tool errors as throwable exceptions inside the code-mode sandbox instead of silently returning `isError` results.

- [`6a6227c`](https://github.com/nuxt-modules/mcp-toolkit/commit/6a6227cfa17f6479277bba47afaf2ea0c8110191) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Generate typed return values in the code-mode `codemode` object from each tool's `outputSchema`, so sandbox code gets accurate autocomplete and type-safety.

## 0.13.3

### Patch Changes

- [#201](https://github.com/nuxt-modules/mcp-toolkit/pull/201) [`7b46428`](https://github.com/nuxt-modules/mcp-toolkit/commit/7b4642859df2979af5f886239df41a26cd8fc7b7) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Fix h3 v2 poisoning Nitro bundle and suppress secure-exec warning

  - Add Nitro alias to resolve h3 from nitropack's own dependency chain, preventing h3 v2 (from peer dep) from overriding h3 v1 in the entire Nitro bundle
  - Add `secure-exec` to `rollupConfig.external` in addition to `externals.external` to suppress the Rollup warning in dev mode

## 0.13.2

### Patch Changes

- [`f761b78`](https://github.com/nuxt-modules/mcp-toolkit/commit/f761b78f0c0790b8555f5354a7053b41987df7dd) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Fix h3 v1/v2 compatibility in compat layer and node transport

  - Replace dynamic `import('h3')` with static imports of `getRequestURL`, `getMethod`, `getRequestHeaders`, `getRequestWebStream` — these exist in both h3 v1 and v2, unlike `toWebRequest` which h3 v2 does not export
  - Make `toWebRequest` synchronous with a manual `Request` construction fallback
  - Add duck-type check for srvx `Request` objects that may not pass `instanceof` across realms
  - Safe `event.node.res` access in node transport (h3 v2 may not have `event.node`)
  - Mark `secure-exec` as Nitro external to suppress build warnings

## 0.13.1

### Patch Changes

- [#196](https://github.com/nuxt-modules/mcp-toolkit/pull/196) [`f608ddd`](https://github.com/nuxt-modules/mcp-toolkit/commit/f608ddd11b410efc44f543d5fc3bf352eb26e0bb) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Read incoming MCP headers from `event.node.req` first so Nitro on Node (e.g. Vercel) does not call `Headers#get` on plain header objects, avoiding `get is not a function` at `/mcp`. Exports `getIncomingHeader` from `@nuxtjs/mcp-toolkit/server` for app middleware.

## 0.13.0

### Minor Changes

- [`8e0d297`](https://github.com/nuxt-modules/mcp-toolkit/commit/8e0d297c1a2486c7c302d9d76a9beb56945ec2cd) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Align MCP tool, resource, and prompt types with the MCP SDK; add `sdk-extra` exports; improve codemode typings; add `sdk-types-compat` tests ([#182](https://github.com/nuxt-modules/mcp-toolkit/pull/182)).

### Patch Changes

- [#192](https://github.com/nuxt-modules/mcp-toolkit/pull/192) [`e129387`](https://github.com/nuxt-modules/mcp-toolkit/commit/e129387838cbe9ebbae4500b138d3fc6af9ad431) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Fix Cloudflare (Nitro) builds failing when codemode’s Node-only executor pulled in `secure-exec` and `node:http`: lazy-load the executor and alias it to a Workers-safe stub when the preset is cloudflare ([#189](https://github.com/nuxt-modules/mcp-toolkit/issues/189)). `experimental_codeMode` remains unsupported on Workers and returns a clear runtime error if enabled.

- [#183](https://github.com/nuxt-modules/mcp-toolkit/pull/183) [`8e011c5`](https://github.com/nuxt-modules/mcp-toolkit/commit/8e011c5f1dc2eb872ba84b5068e3fd8db1e178e7) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Improve h3 compatibility for MCP transports: `eventToWebRequest` uses `event.req` on h3 v2 and calls h3’s `toWebRequest` via namespace when available on v1 (no static `import { toWebRequest }` so h3 v2 installs don’t break); widen the `h3` peer range to `>=1.10.0`.

## 0.12.0

### Minor Changes

- [#169](https://github.com/nuxt-modules/mcp-toolkit/pull/169) [`4e686f9`](https://github.com/nuxt-modules/mcp-toolkit/commit/4e686f9cf16cf2a522bcc7043eadc9abffa54678) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Re-export `completable` from the MCP SDK and register it as a server auto-import for prompt argument autocompletion.

- [#170](https://github.com/nuxt-modules/mcp-toolkit/pull/170) [`516b157`](https://github.com/nuxt-modules/mcp-toolkit/commit/516b157d4e5542caad72b7d3809ff65680baa3ff) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `extractToolNames` utility to extract tool names from MCP JSON-RPC requests. Auto-imported in server context for use in middleware logging, monitoring, and access control.

- [#176](https://github.com/nuxt-modules/mcp-toolkit/pull/176) [`b82fcd2`](https://github.com/nuxt-modules/mcp-toolkit/commit/b82fcd20c485521af80bf714309ab86bcb998e27) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `group` and `tags` fields to `defineMcpTool()`, `defineMcpResource()`, and `defineMcpPrompt()` for organizing definitions by functional categories. Groups are auto-inferred from subdirectory structure (e.g. `server/mcp/tools/admin/delete-user.ts` → `group: 'admin'`), with explicit values taking precedence. For tools, `group` and `tags` are exposed to clients via `_meta` in `tools/list` responses. Recursive file loading is now supported for all definition types.

- [#173](https://github.com/nuxt-modules/mcp-toolkit/pull/173) [`3b6d25b`](https://github.com/nuxt-modules/mcp-toolkit/commit/3b6d25b584aca340165c3d01d821ef52c94c3aa7) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Export `McpToolExtra`, `McpPromptExtra`, and `McpResourceExtra` type aliases for typing the `extra` argument in MCP handlers without importing SDK internals. Add `autoImports` module option to disable all auto-imports and require explicit imports from `@nuxtjs/mcp-toolkit/server`.

- [#174](https://github.com/nuxt-modules/mcp-toolkit/pull/174) [`03dc79e`](https://github.com/nuxt-modules/mcp-toolkit/commit/03dc79e59c58af6330f761b93f8ad46847db6612) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add optional `role` field (`'user'` | `'assistant'`) to prompt definitions. When a handler returns a plain string, this role is used for the auto-wrapped message (defaults to `'user'`).

- [#172](https://github.com/nuxt-modules/mcp-toolkit/pull/172) [`67235c8`](https://github.com/nuxt-modules/mcp-toolkit/commit/67235c84fe5c2a0fd023beec6a3ebd1a76b18998) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `description`, `instructions`, and `icons` to module options and `defineMcpHandler()`. `description` and `icons` are sent as part of `serverInfo` during MCP initialization for client UIs. `instructions` provides operational guidance for AI agents, typically injected into the model's system prompt.

- [#167](https://github.com/nuxt-modules/mcp-toolkit/pull/167) [`f526a9b`](https://github.com/nuxt-modules/mcp-toolkit/commit/f526a9b1430723eb1ef6cfc749fcc5c881ee96e3) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Allow prompt handlers to return a simple `string`, automatically wrapped into `{ messages: [{ role: 'user', content: { type: 'text', text } }] }`. The full `GetPromptResult` return type is still supported.

- [#164](https://github.com/nuxt-modules/mcp-toolkit/pull/164) [`0a53d41`](https://github.com/nuxt-modules/mcp-toolkit/commit/0a53d414d24d43b01ccfcf4902b6a8fc87fee2c3) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Allow tool handlers to return simplified values (`string`, `number`, `boolean`, object, array) that are automatically wrapped into `CallToolResult`. Thrown errors (including H3 errors via `createError()`) are caught and converted to `isError` results. Auto-generate fallback `content` for `isError` and `structuredContent` responses. Deprecate `textResult`, `jsonResult`, and `errorResult` helpers in favor of native returns.
