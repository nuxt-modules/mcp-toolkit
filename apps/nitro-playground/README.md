# Nitro MCP Playground

A bare Nitro v3 app — no Nuxt — for developing `nitro-mcp-toolkit` by hand.

```bash
pnpm dev:nitro   # http://localhost:3030 — inspector UI
```

The toolkit is a plain `workspace:*` dependency, imported by its public
specifier — no alias, so this app exercises the same resolution a user gets.
`pnpm dev:prepare` runs `obuild --stub`, which points the package's `dist` at its
source, and `devServer.watch` reloads the app when that source changes.

## Inspector

`http://localhost:3030` lists every definition and builds a form for it out of
the schema the server advertises: typed inputs for tools, `enum` as a select,
template variables for resource templates, argument lists for prompts. Results
render as they arrive — text, images, `structuredContent`, `isError` — and a
**Wire** panel shows the raw JSON-RPC in both directions.

Two things worth knowing:

- The **modern / legacy** switch re-reads the server on the chosen protocol
  revision, so a definition can be compared across both without a restart.
- The selected definition lives in the hash (`#tool/greet`), so a link or a
  reload lands back on it.

It speaks MCP straight from the browser instead of going through the SDK, which
keeps it dependency-free and, more usefully, means it breaks whenever the HTTP
surface does. `public/inspector.js` is the whole client.

## Probing from the CLI

`scripts/probe.ts` drives a real MCP client over HTTP. It reuses
`nitro-mcp-toolkit/testing`, which only needs something fetch-shaped, so the
helper the unit tests run in memory doubles as a CLI. Useful for scripting and
diffing; the inspector is nicer for exploring.

```bash
pnpm probe:nitro                                          # list
pnpm probe:nitro greet '{"name":"Ada","excited":true}'    # call a tool
pnpm probe:nitro --resource 'playground://docs/tools'      # read a resource
pnpm probe:nitro --prompt summarize '{"text":"..."}'       # render a prompt
```

Point it elsewhere with `MCP_URL`.

## Layout

Each definition exercises exactly one feature, so a regression shows up as a
single failing probe.

| File                                    | Covers                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `server/mcp/tools/greet.ts`             | Input schema, defaults                               |
| `server/mcp/tools/bmi.ts`               | `outputSchema` routed into `structuredContent`       |
| `server/mcp/tools/whoami.ts`            | No-input overload, every `McpContext` field          |
| `server/mcp/tools/boom.ts`              | Thrown errors, including `HTTPError` status and data |
| `server/mcp/tools/pixel.ts`             | Image content blocks                                 |
| `server/mcp/resources/readme.ts`        | Static URI, string return                            |
| `server/mcp/resources/doc-page.ts`      | `uriTemplate`, listing, completions                  |
| `server/mcp/prompts/review.ts`          | No arguments, string return                          |
| `server/mcp/prompts/summarize.ts`       | Arguments, multi-message result                      |
| `server/mcp-admin/tools/cache/purge.ts` | A second server, and a group from a subdirectory     |

Nothing collects these: `nitro.config.ts` installs `mcp()` twice, and each
instance discovers its own directory. Adding a definition means dropping a file
next to its siblings — no restart, and no name to invent, since the filename is
the name.

The second server answers on `/admin/mcp`; point either tool at it with
`MCP_URL=http://localhost:3030/admin/mcp pnpm probe:nitro`.
