# 1.0 rollout

`main` continues releasing stable 0.x packages on `latest`. The shared Nitro/Nuxt implementation is developed on `v1`, starting from `main`. Do not merge that branch or its review stack into `main` before the 1.0 release is approved.

## Review stack

Open the foundation PR first. Later PRs target the preceding branch while it is under review; once that PR merges, retarget its successor to `v1`.

| Order | Branch | Review scope |
| --- | --- | --- |
| 1 | `v1-01-release-rails` | CI for the integration branch and stack, release-channel checks, beta activation for both packages |
| 2 | `v1-02-nitro2` | Nitro 2 adapter, H3 version isolation, transport/context/cancellation tests |
| 3 | `v1-03-shared-api` | Definition metadata, directory overlays, generated imports, shared request APIs |
| 4 | `v1-04-no-mcp-apps` | Remove built-in MCP Apps, their Vue bundler and host bridge, and update migration guidance |
| 5 | `v1-05-nuxt` | Nuxt adapter, retirement of the old runtime and APIs, migrated fixtures and example applications |
| 6 | `v1-06-docs` | Complete migration guide, docs site, READMEs, published agent skill |
| 7 | `v1-07-beta` | Beta consumer validation and release readiness |

Keep each step buildable and tested. Public changes carry their own changesets and enough documentation to use them; the docs step completes the migration material. Example application code moves with the API changes it consumes so CI previews remain usable.

The complete prototype is preserved locally on `v1-prototype`. It is a reference for splitting the implementation, not a PR into `main`. Its built-in MCP Apps integration is excluded from the beta and must not be copied into the Nuxt adapter.

## Beta scope

The beta covers tools, resources, prompts, authentication, streaming, and MCP client compatibility. Built-in MCP Apps support is deferred: no `defineMcpApp`, `useMcpApp`, `@nuxtjs/mcp-toolkit/app`, `app/mcp` discovery, or isolated Vue widget build. Existing App handlers move into regular server-side tool definitions.

General resource, metadata, and plugin APIs remain available. Any later Apps integration is reviewed separately; it is not a prerequisite for the Nuxt runtime migration.

## Specification alignment

The migration targets MCP `2026-07-28`, the current published revision checked on 2026-10-27. Recheck the [versioning page](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning) before beta publication. The [revision changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog) and [compatibility rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) are the reference for protocol behavior.

Review the Nuxt API against the protocol and the shared engine before porting it. An old public API is not a reason to keep its implementation or add a compatibility wrapper. Preserve useful Nuxt integration and document breaking changes; remove obsolete behavior and dependencies in the same implementation step.

The current Nitro runtime targets this revision and delegates protocol handling to pinned `h3-mcp`. The current Nuxt runtime still uses SDK v1 and connection-oriented helpers. Removing Apps does not complete that migration or establish conformance.

| Existing surface | 1.0 decision | Reason and replacement |
| --- | --- | --- |
| Tools, resources, prompts, schemas, annotations, and custom metadata | Keep through the shared definition contract | These expose the protocol's server features; keep their wire representation and errors correct on each supported revision |
| Nuxt directory discovery, layer overrides, auto-imports, inspector, and install links | Keep where useful | Framework integration must consume the shared runtime without implementing protocol behavior |
| Code Mode, its executor, `experimental_codeMode`, and executor dependencies | Remove | Expose ordinary MCP tools; the toolkit does not need a code execution environment |
| Built-in Vue MCP Apps integration | Defer | Removed in step 4; optional extensions are not required for core compatibility |
| `mcp.sessions`, `useMcpSession`, and `invalidateMcpSession` | Remove | Modern MCP has no protocol session; application state belongs in services or explicit handles passed as tool arguments |
| `useMcpServer` registration/removal and `getSdkServer` | Remove | Avoid SDK internals and per-session catalog mutation; compose endpoint definitions explicitly and use the endpoint notifier for supported change notifications |
| `enabled(event)`, dynamic definition resolvers, and session-bound visibility | Replace | Keep endpoint catalogs explicit; check authentication and scopes on every invocation, including completion/enumeration callbacks. Do not capture identity at initialization |
| Global definition pool, handler attribution, and orphan filtering | Replace | Resolve definitions for each endpoint at build time using directory ownership and explicit composition |
| Nuxt's `cache` duration parser and result-caching wrapper | Remove | Application services own result caching and identity-aware keys; engine `ttlMs`/`cacheScope` hints describe client caching and are a separate concern |
| SDK-backed `useMcpElicitation` | Replace | Use the engine's multi round-trip helpers and capability checks; report unsupported operations explicitly for legacy clients |
| `useMcpLogger` coupling client Logging with server observability | Replace | Keep server observability through request context and hooks. Do not promote deprecated protocol Logging or session log levels into the new API |
| Separate Node/Cloudflare transports, SDK v1 providers, session maps, and cleanup timers | Remove | Use the shared H3 runtime and Nitro 2 adapter; retain revision compatibility in the engine |
| Local origin, authorization, notification, and error implementations | Replace | Use the shared engine and toolkit policy; preserve loopback/DNS-rebinding protection, per-request auth, cancellation, and portable errors |

Nonstandard convenience APIs are not automatically protocol violations. Keep one only when it has a clear consumer benefit, does not duplicate the engine, and has no hidden cross-request state or runtime-specific dependency. No new Roots, Sampling, or protocol Logging API: these features are deprecated in the current revision. Server-side observability remains useful and is separate from MCP Logging.

### Beta compatibility gate

Validate the actual packed packages in Nitro 2, Nitro 3, and Nuxt consumers. The shared engine owning a feature is not proof that the framework adapter preserves it. Record unsupported features and tested client versions instead of claiming compatibility with every client.

- Modern `2026-07-28`: `server/discover`, direct requests without initialization, per-request version/capability metadata, standard HTTP headers and mismatch errors, `resultType`, and unsupported-version errors.
- Modern results: deterministic catalogs, pagination, `ttlMs`/`cacheScope`, schema validation, structured content, and protocol errors versus tool execution errors.
- Modern interaction: `subscriptions/listen`, change notifications, progress, stream cancellation, and multi round-trip elicitation with explicit missing-capability behavior. Do not add session requirements or SSE replay state.
- Legacy `2025-03-26`, `2025-06-18`, and `2025-11-25`: handshake and ordinary tools/resources/prompts over Streamable HTTP. Compatibility belongs in the shared engine, without restoring removed Nuxt APIs or the deprecated HTTP+SSE transport.
- Security and isolation: origin checks, OAuth metadata and audience validation, fresh authorization on each call, and concurrent users/endpoints without identity, response-cache, or notification leakage.
- Cleanup: no removed APIs, provider packages, executor packages, or old transport code in the packed Nuxt package. Update consumer examples, migration docs, and the published skill alongside each removal.

## Beta releases

The foundation activates Changesets prerelease mode with the `beta` tag, sets the Changesets base branch to `v1`, and includes major changesets for both packages. Package versions remain unchanged until the generated version PR. Stable publishing from `main` remains automatic on `latest`.

The release workflow runs automatically after merges into `main` or `v1`. Before configuring npm credentials, it requires no prerelease state on `main` and active `beta` mode on `v1`. Feature branches cannot run the release job, including through manual dispatch.

1. Merge the reviewed foundation into `v1`. Changesets opens `changeset-release/v1` against `v1`, preparing `1.0.0-beta.0` for both packages.
2. Keep reviewing the implementation stack into `v1`. Its changesets update the same version PR until it is merged.
3. Review the version PR when a beta is ready to ship. Both package versions must be prereleases; once the Nuxt adapter depends on the Nitro toolkit, its dependency must point at the matching Nitro beta.
4. Merge that version PR into `v1` to publish through the existing CI credentials. Changesets uses `beta`; `latest` stays on the stable line. Subsequent changesets repeat this flow for later betas.
5. Test explicitly installed betas in separate Nitro 2, Nitro 3, and Nuxt consumers. Verify discovery, auth, tools/resources/prompts, streaming/cancellation, and supported MCP clients.

Do not run `changeset publish` locally. The release workflow remains responsible for npm authentication and publishing both packages from their respective accounts.

## General availability

Promotion is a separate maintainer decision after beta testing. Prepare the stable 1.0 versions, remove prerelease state and the CI merge restriction deliberately, and review the integration branch's PR into `main`. Only then does the existing stable release flow publish 1.0 on `latest`.
