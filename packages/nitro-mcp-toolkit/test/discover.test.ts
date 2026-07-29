import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { describe, expect, it } from 'vitest'
import { discoverDefinitions } from '../src/module/discover.ts'
import { identityFromFilename } from '../src/module/naming.ts'

// Normalized, so the expectations below read the same on Windows as what the
// module produces there: `/` throughout, drive letter and all.
const dir = normalize(fileURLToPath(new URL('./fixtures/discovery/server/mcp', import.meta.url)))

describe('identityFromFilename', () => {
  it.each([
    ['list-documentation.ts', 'list-documentation', 'List Documentation'],
    ['listDocumentation.ts', 'list-documentation', 'List Documentation'],
    ['list_documentation.js', 'list-documentation', 'List Documentation'],
    ['greet.mts', 'greet', 'Greet'],
  ])('reads %s as %s', (filename, name, title) => {
    expect(identityFromFilename(filename)).toEqual({ name, title })
  })
})

describe('discoverDefinitions', () => {
  it('finds every definition file, with the identity its path implies', async () => {
    const found = await discoverDefinitions(dir)

    expect(found.map(({ path: _path, ...rest }) => rest)).toEqual([
      {
        dir: 'tools',
        file: 'tools/greet-visitor.ts',
        name: 'greet-visitor',
        title: 'Greet Visitor',
      },
      { dir: 'tools', file: 'tools/named.ts', name: 'named', title: 'Named' },
      {
        dir: 'tools',
        file: 'tools/nested/deep.ts',
        group: 'nested',
        name: 'deep',
        title: 'Deep',
      },
      { dir: 'resources', file: 'resources/readme.ts', name: 'readme', title: 'Readme' },
      { dir: 'prompts', file: 'prompts/review.ts', name: 'review', title: 'Review' },
    ])
  })

  it('points at the file it found, absolutely', async () => {
    const [first] = await discoverDefinitions(dir)

    expect(first?.path).toBe(`${dir}/tools/greet-visitor.ts`)
  })

  it('answers nothing for a directory that holds no definitions', async () => {
    await expect(discoverDefinitions(`${dir}-does-not-exist`)).resolves.toEqual([])
  })
})
