import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'pathe'
import { createNitro } from 'nitro/builder'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { discoverServerConfig } from '../src/module/discover.ts'
import mcp from '../src/module/index.ts'
import { defineMcpServer } from '../src/runtime/server.ts'

let root: string
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'mcp-server-config-')))
})
afterEach(() => rm(root, { recursive: true, force: true }))

it('selects the first layer containing an index and ignores nested indexes', async () => {
  const app = join(root, 'app')
  const layer = join(root, 'layer')
  await mkdir(join(app, 'tools'), { recursive: true })
  await mkdir(layer)
  await writeFile(join(app, 'tools/index.ts'), 'export default {}')
  await writeFile(join(layer, 'index.mjs'), 'export default {}')
  expect(await discoverServerConfig([app, layer])).toEqual([join(layer, 'index.mjs')])
  await writeFile(join(app, 'index.ts'), 'export default {}')
  expect(await discoverServerConfig([app, layer])).toEqual([join(app, 'index.ts')])
  await writeFile(join(app, 'index.mts'), 'export default {}')
  expect((await discoverServerConfig([app, layer])).map((file) => basename(file))).toEqual([
    'index.mts',
    'index.ts',
  ])
})

it('rejects ambiguous indexes in the selected layer', async () => {
  await writeFile(join(root, 'index.ts'), 'export default {}')
  await writeFile(join(root, 'index.js'), 'export default {}')
  const nitro = await createNitro({
    rootDir: root,
    dev: false,
    preset: 'standard',
    modules: [mcp({ dir: '.' })],
  })
  try {
    const template = nitro.options.virtual['#mcp/mcp/handler']
    expect(typeof template).toBe('function')
    if (typeof template !== 'function') throw new Error('Expected a handler template')
    await expect(template()).rejects.toThrow('/mcp has more than one index file')
  } finally {
    await nitro.close()
  }
})

it('preserves runtime callbacks and rejects invalid JavaScript exports', () => {
  const config = { instructions: 'Hello', auth: { validate: () => true } }
  expect(defineMcpServer(config)).toBe(config)
  expect(() => Reflect.apply(defineMcpServer, undefined, [{ auth: null }])).toThrow(
    'authentication options',
  )
  for (const value of [undefined, null, false, 'server', []]) {
    expect(() => Reflect.apply(defineMcpServer, undefined, [value])).toThrow(
      'default-export server configuration',
    )
  }
})
