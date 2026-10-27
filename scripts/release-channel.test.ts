import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { assembleReleasePlan } from '@changesets/assemble-release-plan'
import { readConfig } from '@changesets/config'
import { readPreState } from '@changesets/pre'
import { readChangesets } from '@changesets/read'
import { getPackages } from '@manypkg/get-packages'
import { releaseChannel } from './release-channel.ts'

describe('release channel', () => {
  it('keeps main on latest without prerelease state', () => {
    assert.equal(releaseChannel('main', undefined), 'latest')
  })

  it('refuses prerelease state on main', () => {
    for (const state of [{ mode: 'pre', tag: 'beta' }, { mode: 'exit', tag: 'beta' }, null]) {
      assert.throws(() => releaseChannel('main', state), /main publishes stable packages only/)
    }
  })

  it('allows beta releases on the integration branch', () => {
    assert.equal(releaseChannel('v1', { mode: 'pre', tag: 'beta' }), 'beta')
  })

  it('plans 1.0 betas for both packages using the checked-in Changesets configuration', async () => {
    const root = fileURLToPath(new URL('../', import.meta.url))
    const packages = await getPackages(root)
    const result = await readConfig(root, packages)
    if (result.errors) throw new Error(result.errors.join('\n'))
    assert.equal(result.config.baseBranch, 'v1')

    const state = await readPreState(root)
    assert.equal(releaseChannel('v1', state), 'beta')
    const changesets = await readChangesets(root)
    const plan = assembleReleasePlan([
      ...changesets,
      {
        id: 'next-beta-test',
        summary: 'Check the next beta release.',
        releases: [
          { name: '@nuxtjs/mcp-toolkit', type: 'patch' },
          { name: 'nitro-mcp-toolkit', type: 'patch' },
        ],
      },
    ], packages, result.config, state)

    const releases = plan.releases.filter(release => release.type !== 'none')
    assert.deepEqual(releases.map(release => release.name).sort(), ['@nuxtjs/mcp-toolkit', 'nitro-mcp-toolkit'])
    for (const release of releases) {
      assert.match(release.newVersion, /^1\.0\.0-beta\.\d+$/)
    }
  })

  it('refuses a beta release before prerelease mode is activated', () => {
    for (const state of [undefined, null, {}, { tag: 'beta' }]) {
      assert.throws(() => releaseChannel('v1', state), /requires Changesets prerelease mode/)
    }
  })

  it('refuses an exit from prerelease mode or a different tag on the integration branch', () => {
    for (const state of [{ mode: 'exit', tag: 'beta' }, { mode: 'pre', tag: 'latest' }, { mode: 'pre', tag: 'alpha' }]) {
      assert.throws(() => releaseChannel('v1', state), /requires Changesets prerelease mode/)
    }
  })

  it('refuses releases from feature branches and tags', () => {
    for (const branch of ['v1-02-nitro2', 'fix/example', 'v1.0.0-beta.0', '']) {
      assert.throws(() => releaseChannel(branch, { mode: 'pre', tag: 'beta' }), /Releases are restricted/)
    }
  })
})
