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

  it('supports a custom entry, stylesheet aliases, and additional Vite plugins', async () => {
    playground = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.tmp-bundle-'))
    const css = join(playground, 'app.css')
    await writeFile(css, '#mcp-app { --mcp-test-color: #123456; }')

    const html = await bundleAppHtml(
      { name: 'custom-app', sfc: join(playground, 'custom-app.vue') },
      '<script setup lang="ts">const label = \'custom entry\'</script><template><p>{{ label }}</p></template>',
      join(playground, '.nuxt/mcp-apps'),
      resolver,
      silentLog,
      {
        srcDir: playground,
        css: ['~/app.css'],
        entry: `import { createApp } from 'vue'
import App from './App.vue'
document.documentElement.dataset.mcpEntry = 'custom'
createApp(App).mount('#mcp-app')
`,
        vitePlugins: [{
          name: 'mcp-test-marker',
          transformIndexHtml: html => html.replace('</head>', '<meta name="mcp-test-plugin" content="enabled"></head>'),
        }],
      },
    )

    expect(html).toContain('custom entry')
    expect(html).toContain('mcpEntry')
    expect(html).toContain('--mcp-test-color')
    expect(html).toContain('mcp-test-plugin')
    expect(html).toContain('class="isolate"')
  })

  it('installs default-exported Vue plugins in the generated entry', async () => {
    playground = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.tmp-bundle-'))
    const plugin = join(playground, 'vue-plugin.ts')
    await writeFile(plugin, `export default {
  install() {
    document.head.insertAdjacentHTML('beforeend', '<meta name="mcp-vue-plugin" content="enabled">')
  },
}
`)

    const html = await bundleAppHtml(
      { name: 'vue-plugin-app', sfc: join(playground, 'vue-plugin-app.vue') },
      '<template><p>Vue plugin app</p></template>',
      join(playground, '.nuxt/mcp-apps'),
      resolver,
      silentLog,
      {
        srcDir: playground,
        vuePlugins: [plugin],
      },
    )

    expect(html).toContain('mcp-vue-plugin')
    expect(html).toContain('Vue plugin app')
  })
})
