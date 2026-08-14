import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createResolver } from '@nuxt/kit'
import { consola } from 'consola'
import { afterEach, describe, expect, it } from 'vitest'
import { bundleAppHtml } from '../src/setup/mcp-apps/bundle'

const silentLog = consola.create({ level: -999 })
const resolver = createResolver(fileURLToPath(new URL('../src/module.ts', import.meta.url)))

describe('bundleAppHtml', () => {
  let playground: string | undefined

  afterEach(async () => {
    if (playground) {
      await rm(playground, { recursive: true, force: true })
      playground = undefined
    }
  })

  it('bundles a lang=ts SFC when the host tsconfig extends a missing .nuxt/tsconfig.json', async () => {
    playground = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.tmp-bundle-'))
    await writeFile(join(playground, 'tsconfig.json'), JSON.stringify({ extends: './.nuxt/tsconfig.json' }))
    const helper = join(playground, 'helper.ts')
    await writeFile(helper, 'export const label = \'mcp-bundle-helper\' as string\n')

    const prevCwd = process.cwd()
    process.chdir(playground)
    try {
      const html = await bundleAppHtml(
        { name: 'color-picker', sfc: join(playground, 'color-picker.vue') },
        `<script setup lang="ts">import { label } from ${JSON.stringify(helper)}</script><template><p>{{ label }}</p></template>`,
        join(playground, '.nuxt/mcp-apps'),
        resolver,
        silentLog,
      )

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('color-picker')
      expect(html).toContain('mcp-bundle-helper')
    }
    finally {
      process.chdir(prevCwd)
    }
  })
})
