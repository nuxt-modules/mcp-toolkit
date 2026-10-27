# 1.0 rollout

`main` continues releasing stable 0.x packages on `latest`. The shared Nitro/Nuxt implementation is developed on `codex/v1`, starting from `main`. Do not merge that branch or its review stack into `main` before the 1.0 release is approved.

## Review stack

Open the foundation PR first. Later PRs target the preceding branch while it is under review; once that PR merges, retarget its successor to `codex/v1`.

| Order | Branch | Review scope |
| --- | --- | --- |
| 1 | `codex/v1-01-release-rails` | CI for the integration branch and stack, release-channel checks, rollout process |
| 2 | `codex/v1-02-nitro2` | Nitro 2 adapter, H3 version isolation, transport/context/cancellation tests |
| 3 | `codex/v1-03-shared-api` | Definition metadata, directory overlays, generated imports, shared request APIs |
| 4 | `codex/v1-04-nuxt` | Nuxt adapter, Vue MCP Apps, migrated fixtures and example applications, API removals |
| 5 | `codex/v1-05-docs` | Complete migration guide, docs site, READMEs, published agent skill |
| 6 | `codex/v1-06-beta` | Reviewed prerelease activation and consumer validation |

Keep each step buildable and tested. Public changes carry their own changesets and enough documentation to use them; the docs step completes the migration material. Example application code moves with the API changes it consumes so CI previews remain usable.

The complete prototype is preserved locally on `codex/shared-mcp-engine-v1`. It is a reference for splitting the implementation, not a PR into `main`.

## Beta releases

The foundation does not enter Changesets prerelease mode, change package versions, or publish a beta. Stable publishing from `main` remains automatic. The release workflow can run against `codex/v1` only through a manual dispatch and only when `.changeset/pre.json` specifies `mode: pre` and `tag: beta`.

When the Nitro and Nuxt integrations are ready for external testing:

1. Prepare a prerelease activation PR against `codex/v1`. A maintainer chooses when to run `pnpm changeset pre enter beta`; include the generated state and the major changesets for both packages. The intended versions are `1.0.0-beta.N`.
2. Merge the activation PR after review, then manually run the release workflow on `codex/v1`. Changesets opens the version PR against that branch.
3. Review the version PR: both package versions must be prereleases, and Nuxt's dependency must point at the matching Nitro beta. Merge it into `codex/v1`.
4. Manually run the release workflow on `codex/v1` again to publish through the existing CI credentials. Changesets uses the `beta` tag from its prerelease state; `latest` stays on the stable line.
5. Test explicitly installed betas in separate Nitro 2, Nitro 3, and Nuxt consumers. Verify discovery, auth, tools/resources/prompts, streaming/cancellation, and the clients and MCP Apps hosts we support.

Do not run `changeset publish` locally. The release workflow remains responsible for npm authentication and publishing both packages from their respective accounts.

## General availability

Promotion is a separate maintainer decision after beta testing. Prepare the stable 1.0 versions, remove prerelease state and the CI merge restriction deliberately, and review the integration branch's PR into `main`. Only then does the existing stable release flow publish 1.0 on `latest`.
