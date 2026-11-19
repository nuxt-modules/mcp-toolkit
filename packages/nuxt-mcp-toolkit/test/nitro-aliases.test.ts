import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import type { NitroConfig } from 'nitropack'
import { afterEach, describe, expect, it } from 'vitest'
import { forceH3ResolutionViaNitropack } from '../src/setup/nitro-aliases'

let root: string | undefined

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true })
    root = undefined
  }
})

async function writePackage(dir: string, pkg: Record<string, unknown>): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg))
  await writeFile(join(dir, 'index.js'), '')
}

/** A Nuxt install whose server builder depends on `serverDeps`, with nitropack and h3 v1 installed next to it. */
async function runNitroConfig(serverDeps: Record<string, string>): Promise<NitroConfig> {
  root = await realpath(await mkdtemp(join(tmpdir(), 'mcp-nitro-aliases-')))
  const modules = join(root, 'node_modules')
  await writePackage(join(modules, 'nuxt'), { name: 'nuxt', main: 'index.js' })
  await writePackage(join(modules, '@nuxt/nitro-server'), { name: '@nuxt/nitro-server', main: 'index.js', dependencies: serverDeps })
  await writePackage(join(modules, 'nitropack'), { name: 'nitropack', main: 'index.js' })
  await writePackage(join(modules, 'h3'), { name: 'h3', version: '1.15.11', main: 'index.js' })
  const appDir = join(modules, 'nuxt/dist/app')
  await mkdir(appDir, { recursive: true })

  const config: NitroConfig = {}
  await forceH3ResolutionViaNitropack(appDir, config)
  return config
}

describe('h3 alias', () => {
  it('points `h3` at the copy nitropack uses on Nitro v2', async () => {
    const config = await runNitroConfig({ nitropack: '^2.13.6' })
    expect(config.alias?.h3).toBe(join(root!, 'node_modules/h3/index.js'))
  })

  it('leaves `h3` unaliased on Nitro v3, even when nitropack is installed', async () => {
    const config = await runNitroConfig({ nitro: '^3.0.0' })
    expect(config.alias?.h3).toBeUndefined()
  })
})
