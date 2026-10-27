import { fileURLToPath } from 'node:url'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, normalize } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFINITION_DIRS, discoverDefinitions, discoverPlugins } from '../src/module/discover.ts'
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

describe('directory overlays', () => {
  let root: string
  let app: string
  let base: string

  beforeAll(async () => {
    root = normalize(await realpath(await mkdtemp(join(tmpdir(), 'mcp-overlays-'))))
    app = join(root, 'app')
    base = join(root, 'base')
    for (const layer of [app, base]) {
      for (const kind of DEFINITION_DIRS) {
        await mkdir(join(layer, kind, 'nested'), { recursive: true })
        await writeFile(join(layer, kind, 'nested/shared.ts'), 'export default {}')
      }
      await writeFile(join(layer, 'plugins.ts'), 'export default []')
    }
    await writeFile(join(base, 'tools/inherited.ts'), 'export default {}')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('uses the first matching relative file across all definition kinds', async () => {
    const definitions = await discoverDefinitions([app, base])
    expect(definitions.map((definition) => definition.file)).toEqual([
      'tools/inherited.ts',
      'tools/nested/shared.ts',
      'resources/nested/shared.ts',
      'prompts/nested/shared.ts',
    ])
    for (const definition of definitions.filter((definition) => definition.name === 'shared')) {
      expect(definition.path).toBe(join(app, definition.file))
      expect(definition.group).toBe('nested')
    }
    expect(definitions[0]?.path).toBe(join(base, 'tools/inherited.ts'))
  })

  it('keeps the chosen directory order and does not mutate it', async () => {
    const roots = [base, app] as const
    const definitions = await discoverDefinitions(roots)
    expect(
      definitions.find((definition) => definition.file === 'tools/nested/shared.ts')?.path,
    ).toBe(join(base, 'tools/nested/shared.ts'))
    expect(roots).toEqual([base, app])
  })

  it('includes generated specifiers without resolving them as filesystem paths', async () => {
    const definitions = await discoverDefinitions([], {
      tools: ['#generated/generatedTool.mjs'],
      resources: ['#generated/document.ts'],
      prompts: ['integration/generatedPrompt'],
    })
    expect(definitions).toEqual([
      {
        dir: 'tools',
        path: '#generated/generatedTool.mjs',
        file: 'tools/generatedTool.mjs',
        name: 'generated-tool',
        title: 'Generated Tool',
      },
      {
        dir: 'resources',
        path: '#generated/document.ts',
        file: 'resources/document.ts',
        name: 'document',
        title: 'Document',
      },
      {
        dir: 'prompts',
        path: 'integration/generatedPrompt',
        file: 'prompts/generatedPrompt',
        name: 'generated-prompt',
        title: 'Generated Prompt',
      },
    ])
  })

  it('uses the first directory containing plugins and inherits when it has none', async () => {
    await expect(discoverPlugins([app, base])).resolves.toEqual([join(app, 'plugins.ts')])
    await expect(discoverPlugins([join(root, 'missing'), base])).resolves.toEqual([
      join(base, 'plugins.ts'),
    ])
    await expect(discoverPlugins([])).resolves.toEqual([])
  })

  it('reports all plugins in the selected layer so ambiguity is still rejected', async () => {
    await mkdir(join(root, 'ambiguous'))
    await writeFile(join(root, 'ambiguous/plugins.ts'), 'export default []')
    await writeFile(join(root, 'ambiguous/plugins.mjs'), 'export default []')
    await expect(discoverPlugins([join(root, 'ambiguous'), base])).resolves.toEqual([
      join(root, 'ambiguous/plugins.mjs'),
      join(root, 'ambiguous/plugins.ts'),
    ])
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
