# Nitro MCP Playground

A bare Nitro v3 app — no Nuxt — for developing `nitro-mcp-toolkit` by hand.

```bash
pnpm dev:nitro     # http://localhost:3030
pnpm probe:nitro   # list every definition, on both protocol eras
```

The toolkit is a plain `workspace:*` dependency, imported by its public
specifier — no alias, so this app exercises the same resolution a user gets.
`pnpm dev:prepare` runs `obuild --stub`, which points the package's `dist` at its
source, and `devServer.watch` reloads the app when that source changes.

## Probing

`scripts/probe.ts` drives a real MCP client over HTTP. It reuses
`nitro-mcp-toolkit/testing`, which only needs something fetch-shaped, so the
helper the unit tests run in memory doubles as a CLI.

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

| File                               | Covers                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `server/mcp/tools/greet.ts`        | Input schema, defaults                               |
| `server/mcp/tools/bmi.ts`          | `outputSchema` routed into `structuredContent`       |
| `server/mcp/tools/whoami.ts`       | No-input overload, every `McpContext` field          |
| `server/mcp/tools/boom.ts`         | Thrown errors, including `HTTPError` status and data |
| `server/mcp/tools/pixel.ts`        | Image content blocks                                 |
| `server/mcp/resources/readme.ts`   | Static URI, string return                            |
| `server/mcp/resources/doc-page.ts` | `ResourceTemplate`, listing, completions             |
| `server/mcp/prompts/review.ts`     | No arguments, string return                          |
| `server/mcp/prompts/summarize.ts`  | Arguments, multi-message result                      |

`server/mcp/index.ts` collects them and `server/routes/mcp.ts` mounts the
handler. Wave 2 replaces that collection with directory discovery, so adding a
definition today means dropping a file next to its siblings and listing it once.
