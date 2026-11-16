import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('DevTools setup', () => {
  it('imports only packages the module declares', () => {
    const pkg = JSON.parse(read('../package.json'))
    const declared = new Set(Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }))
    const source = read('../src/runtime/server/mcp/devtools/index.ts')
    const imported = [...source.matchAll(/^import (?!type )[^'"]*from '([^'.][^']*)'/gm)]
      .map(([, specifier]) => specifier!)
      .filter(specifier => !specifier.startsWith('node:'))
      .map(specifier => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!)

    expect(imported.filter(name => !declared.has(name))).toEqual([])
  })
})
