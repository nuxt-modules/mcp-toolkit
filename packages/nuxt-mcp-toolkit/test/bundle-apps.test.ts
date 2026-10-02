import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createResolver } from '@nuxt/kit'
import { consola } from 'consola'
import { afterEach, describe, expect, it } from 'vitest'
import { appSourceAliases } from '../src/setup/mcp-apps/app-source'
import { bundleAppHtml } from '../src/setup/mcp-apps/bundle'
import { parseSfcApp } from '../src/setup/mcp-apps/parse-sfc'

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
        { rootDir: playground, alias: {} },
      )

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('color-picker')
      expect(html).toContain('mcp-bundle-helper')
    }
    finally {
      process.chdir(prevCwd)
    }
  })

  it('treats modules imported from the app source like the app SFC', async () => {
    playground = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.tmp-bundle-'))
    const app = join(playground, 'app')
    await mkdir(join(app, 'mcp'), { recursive: true })
    await mkdir(join(app, 'components'), { recursive: true })
    await mkdir(join(playground, 'shared'), { recursive: true })
    await writeFile(join(playground, 'tsconfig.json'), JSON.stringify({
      files: [],
      references: [{ path: './.nuxt/tsconfig.app.json' }],
    }))
    await writeFile(join(app, 'components', 'HelloChild.vue'), `<script setup lang="ts">
const props = defineProps<{ name: string }>()
const greeting = computed((): string => \`mcp-child-greeting \${props.name}\`)
</script>

<template>
  <p>{{ greeting }}</p>
</template>
`)
    await writeFile(join(playground, 'shared', 'prefix.ts'), 'export const prefix: string = \'mcp-shared-prefix\'\n')
    await writeFile(join(playground, 'root-util.ts'), 'export const rootLabel: string = \'mcp-root-util\'\n')
    await writeFile(join(app, 'mcp', 'hello.css'), '#mcp-app { --mcp-colocated: #abcdef; }')
    await writeFile(join(app, 'theme.css'), '#mcp-app { --mcp-option-css: #fedcba; }')
    const sfc = join(app, 'mcp', 'hello.vue')
    await writeFile(sfc, `<script setup lang="ts">
import HelloChild from '../components/HelloChild.vue'
import { prefix } from '#shared/prefix'
import { rootLabel } from '~~/root-util'
import './hello.css'

defineMcpApp({ description: 'Says hello' })
const name = ref(\`\${prefix} \${rootLabel}\`)
</script>

<template>
  <HelloChild :name="name" />
</template>
`)

    const parsed = await parseSfcApp(sfc)
    const html = await bundleAppHtml(
      { name: 'hello', sfc },
      parsed.bundleSource,
      join(playground, '.nuxt/mcp-apps'),
      resolver,
      silentLog,
      {
        rootDir: playground,
        alias: { '~': app, '~~': playground, '#shared': join(playground, 'shared') },
        css: ['./app/theme.css'],
      },
    )

    expect(html).toContain('mcp-child-greeting')
    expect(html).toContain('mcp-shared-prefix')
    expect(html).toContain('mcp-root-util')
    expect(html).toContain('--mcp-colocated')
    expect(html).toContain('--mcp-option-css')
    expect(html).not.toMatch(/\bcomputed\(/)
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
        rootDir: playground,
        alias: { '~': playground },
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
        rootDir: playground,
        alias: {},
        vuePlugins: [plugin],
      },
    )

    expect(html).toContain('mcp-vue-plugin')
    expect(html).toContain('Vue plugin app')
  })
})

describe('appSourceAliases', () => {
  it('keeps aliases into the app source and drops those into Nuxt and the build directory', () => {
    const root = '/project'
    const nuxt = '/project/node_modules/.pnpm/nuxt@4/node_modules/nuxt/dist/app'
    expect(appSourceAliases({
      '~': '/project/app/',
      '~~': '/project/',
      '#shared': '/project/shared/',
      '#build': '/project/.nuxt/',
      '#internal/nuxt/paths': '/project/.nuxt/paths.mjs',
      '#app': `${nuxt}/`,
      'vue-demi': `${nuxt}/compat/vue-demi`,
      '#elsewhere': '/other/dir',
    }, root, '/project/.nuxt')).toEqual({
      '~': '/project/app',
      '~~': '/project',
      '#shared': '/project/shared',
    })
  })
})
