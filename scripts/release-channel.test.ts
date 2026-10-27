import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
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
    assert.equal(releaseChannel('codex/v1', { mode: 'pre', tag: 'beta' }), 'beta')
  })

  it('refuses a beta release before prerelease mode is activated', () => {
    for (const state of [undefined, null, {}, { tag: 'beta' }]) {
      assert.throws(() => releaseChannel('codex/v1', state), /requires Changesets prerelease mode/)
    }
  })

  it('refuses an exit from prerelease mode or a different tag on the integration branch', () => {
    for (const state of [{ mode: 'exit', tag: 'beta' }, { mode: 'pre', tag: 'latest' }, { mode: 'pre', tag: 'alpha' }]) {
      assert.throws(() => releaseChannel('codex/v1', state), /requires Changesets prerelease mode/)
    }
  })

  it('refuses releases from feature branches and tags', () => {
    for (const branch of ['codex/v1-02-nitro2', 'fix/example', 'v1.0.0-beta.0', '']) {
      assert.throws(() => releaseChannel(branch, { mode: 'pre', tag: 'beta' }), /Releases are restricted/)
    }
  })
})
