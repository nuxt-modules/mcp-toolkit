import { existsSync, readFileSync } from 'node:fs'

export function releaseChannel(branch: string, preState: unknown): 'latest' | 'beta' {
  if (branch === 'main') {
    if (preState !== undefined) {
      throw new Error('main publishes stable packages only; remove Changesets prerelease state.')
    }
    return 'latest'
  }

  if (branch !== 'codex/v1') {
    throw new Error('Releases are restricted to main and codex/v1.')
  }

  if (
    typeof preState !== 'object'
    || preState === null
    || !('mode' in preState)
    || preState.mode !== 'pre'
    || !('tag' in preState)
    || preState.tag !== 'beta'
  ) {
    throw new Error('codex/v1 requires Changesets prerelease mode with the beta tag.')
  }

  return 'beta'
}

if (import.meta.main) {
  const file = new URL('../.changeset/pre.json', import.meta.url)
  const state: unknown = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
  console.log(`Release channel: ${releaseChannel(process.env.GITHUB_REF_NAME ?? '', state)}`)
}
