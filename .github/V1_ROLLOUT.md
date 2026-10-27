# 1.0 rollout

`main` continues releasing stable 0.x packages on `latest`. The shared Nitro/Nuxt implementation is developed on `v1`, starting from `main`. Do not merge that branch or its review stack into `main` before the 1.0 release is approved.

## Review stack

Open the foundation PR first. Later PRs target the preceding branch while it is under review; once that PR merges, retarget its successor to `v1`.

| Order | Branch | Review scope |
| --- | --- | --- |
| 1 | `v1-01-release-rails` | CI for the integration branch and stack, release-channel checks, beta activation for both packages |
| 2 | `v1-02-nitro2` | Nitro 2 adapter, H3 version isolation, transport/context/cancellation tests |
| 3 | `v1-03-shared-api` | Definition metadata, directory overlays, generated imports, shared request APIs |
| 4 | `v1-04-nuxt` | Nuxt adapter, Vue MCP Apps, migrated fixtures and example applications, API removals |
| 5 | `v1-05-docs` | Complete migration guide, docs site, READMEs, published agent skill |
| 6 | `v1-06-beta` | Beta consumer validation and release readiness |

Keep each step buildable and tested. Public changes carry their own changesets and enough documentation to use them; the docs step completes the migration material. Example application code moves with the API changes it consumes so CI previews remain usable.

The complete prototype is preserved locally on `v1-prototype`. It is a reference for splitting the implementation, not a PR into `main`.

## Beta releases

The foundation activates Changesets prerelease mode with the `beta` tag, sets the Changesets base branch to `v1`, and includes major changesets for both packages. Package versions remain unchanged until the generated version PR. Stable publishing from `main` remains automatic on `latest`.

The release workflow runs automatically after merges into `main` or `v1`. Before configuring npm credentials, it requires no prerelease state on `main` and active `beta` mode on `v1`. Feature branches cannot run the release job, including through manual dispatch.

1. Merge the reviewed foundation into `v1`. Changesets opens `changeset-release/v1` against `v1`, preparing `1.0.0-beta.0` for both packages.
2. Keep reviewing the implementation stack into `v1`. Its changesets update the same version PR until it is merged.
3. Review the version PR when a beta is ready to ship. Both package versions must be prereleases; once the Nuxt adapter depends on the Nitro toolkit, its dependency must point at the matching Nitro beta.
4. Merge that version PR into `v1` to publish through the existing CI credentials. Changesets uses `beta`; `latest` stays on the stable line. Subsequent changesets repeat this flow for later betas.
5. Test explicitly installed betas in separate Nitro 2, Nitro 3, and Nuxt consumers. Verify discovery, auth, tools/resources/prompts, streaming/cancellation, and the clients and MCP Apps hosts we support.

Do not run `changeset publish` locally. The release workflow remains responsible for npm authentication and publishing both packages from their respective accounts.

## General availability

Promotion is a separate maintainer decision after beta testing. Prepare the stable 1.0 versions, remove prerelease state and the CI merge restriction deliberately, and review the integration branch's PR into `main`. Only then does the existing stable release flow publish 1.0 on `latest`.
