import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { Resolver } from '@nuxt/kit'
import type { ConsolaInstance } from 'consola'
import type { InlineConfig } from 'vite'
import type { DiscoveredApp } from './discover'
import type { McpAppsOptions } from './options'

interface BundleOptions extends McpAppsOptions {
  srcDir: string
}

/** Programmatic Vite build that inlines a Vue SFC into a single self-contained HTML page. */
export async function bundleAppHtml(
  app: DiscoveredApp,
  bundleSource: string,
  buildRoot: string,
  resolver: Resolver,
  log: ConsolaInstance,
  options: BundleOptions = { srcDir: process.cwd() },
): Promise<string> {
  const entryDir = resolvePath(buildRoot, '__entry__', app.name)
  const outDir = resolvePath(buildRoot, '__dist__', app.name)
  await mkdir(entryDir, { recursive: true })

  const localSfc = resolvePath(entryDir, 'App.vue')
  await writeFile(localSfc, bundleSource, 'utf-8')

  const isolatedTsconfig = resolvePath(entryDir, 'tsconfig.json')
  // Vite 8's oxc transform skips a tsconfig that doesn't list the .vue file and
  // walks up to the host app's tsconfig, which extends .nuxt/tsconfig.json before Nuxt writes it.
  await writeFile(
    isolatedTsconfig,
    JSON.stringify({
      compilerOptions: { target: 'esnext', module: 'esnext', jsx: 'preserve', moduleResolution: 'bundler', strict: false, isolatedModules: true },
      files: ['App.vue', 'entry.ts'],
    }, null, 2),
    'utf-8',
  )

  await writeFile(resolvePath(entryDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${app.name}</title>
  </head>
  <body>
    <div id="mcp-app" class="isolate"></div>
    <script type="module" src="./entry.ts"></script>
  </body>
</html>
`, 'utf-8')

  if (options.entry && options.vuePlugins?.length) {
    throw new Error('MCP App bundle options cannot combine entry with vuePlugins.')
  }

  const cssImports = (options.css ?? []).map(css => `import ${JSON.stringify(css)}\n`).join('')
  const vuePluginImports = (options.vuePlugins ?? [])
    .map((plugin, index) => `import mcpVuePlugin${index} from ${JSON.stringify(plugin)}\n`)
    .join('')
  const vuePluginUses = (options.vuePlugins ?? [])
    .map((_, index) => `app.use(mcpVuePlugin${index})\n`)
    .join('')
  const defaultEntry = `import { createApp } from 'vue'
${vuePluginImports}import App from './App.vue'

const app = createApp(App)
${vuePluginUses}app.mount('#mcp-app')
`
  await writeFile(resolvePath(entryDir, 'entry.ts'), `${cssImports}${options.entry ?? defaultEntry}`, 'utf-8')

  const [{ build: viteBuild, transformWithOxc }, { default: vue }, { viteSingleFile }] = await Promise.all([
    import('vite'),
    import('@vitejs/plugin-vue'),
    import('vite-plugin-singlefile'),
  ])

  // Absolute source path so the bundle works when the toolkit is stub-built (dist/ empty).
  const runtimeAppEntry = resolver.resolve('runtime/app/index')

  // Vite 8 turns `esbuild.tsconfigRaw` into oxc options and still auto-discovers
  // tsconfig from imported files that live outside this entry dir (e.g. `./stay-format`).
  const vite8 = typeof transformWithOxc === 'function'

  const config: InlineConfig = {
    root: entryDir,
    logLevel: 'silent',
    configFile: false,
    ...(vite8
      ? { oxc: false }
      : { esbuild: { tsconfigRaw: '{}' } }),
    resolve: {
      alias: [
        { find: '@nuxtjs/mcp-toolkit/app', replacement: runtimeAppEntry },
        { find: '~', replacement: options.srcDir },
        { find: '@', replacement: options.srcDir },
      ],
    },
    plugins: [vue(), ...(options.vitePlugins ?? []), viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: true,
      assetsInlineLimit: 100 * 1024 * 1024,
      ...(vite8 ? { rolldownOptions: { tsconfig: false } } : {}),
      rollupOptions: {
        input: resolvePath(entryDir, 'index.html'),
      },
    },
  }
  await viteBuild(config)

  const htmlPath = resolvePath(outDir, 'index.html')
  if (!existsSync(htmlPath)) {
    log.error(`MCP App build for "${app.name}" produced no index.html at ${htmlPath}`)
    throw new Error(`MCP App build for "${app.name}" failed.`)
  }

  return readFile(htmlPath, 'utf-8')
}
