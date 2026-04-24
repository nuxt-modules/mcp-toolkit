import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { Resolver } from '@nuxt/kit'
import type { ConsolaInstance } from 'consola'
import type { DiscoveredApp } from './discover'

/** Programmatic Vite build that inlines a Vue SFC into a single self-contained HTML page. */
export async function bundleAppHtml(
  app: DiscoveredApp,
  bundleSource: string,
  buildRoot: string,
  resolver: Resolver,
  log: ConsolaInstance,
): Promise<string> {
  const entryDir = resolvePath(buildRoot, '__entry__', app.name)
  const outDir = resolvePath(buildRoot, '__dist__', app.name)
  await mkdir(entryDir, { recursive: true })

  const localSfc = resolvePath(entryDir, 'App.vue')
  await writeFile(localSfc, bundleSource, 'utf-8')

  // Self-contained tsconfig so Vite/esbuild doesn't walk up to the host project's tsconfig.
  await writeFile(
    resolvePath(entryDir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { target: 'esnext', module: 'esnext', jsx: 'preserve', moduleResolution: 'bundler', strict: false, isolatedModules: true } }, null, 2),
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
    <div id="mcp-app"></div>
    <script type="module" src="./entry.ts"></script>
  </body>
</html>
`, 'utf-8')

  await writeFile(resolvePath(entryDir, 'entry.ts'), `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#mcp-app')
`, 'utf-8')

  const [{ build: viteBuild }, { default: vue }, { viteSingleFile }] = await Promise.all([
    import('vite'),
    import('@vitejs/plugin-vue'),
    import('vite-plugin-singlefile'),
  ])

  // Absolute source path so the bundle works when the toolkit is stub-built (dist/ empty).
  const runtimeAppEntry = resolver.resolve('runtime/app/index')

  await viteBuild({
    root: entryDir,
    logLevel: 'silent',
    configFile: false,
    esbuild: { tsconfigRaw: '{}' },
    resolve: {
      alias: [
        { find: '@nuxtjs/mcp-toolkit/app', replacement: runtimeAppEntry },
      ],
    },
    plugins: [vue(), viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: true,
      assetsInlineLimit: 100 * 1024 * 1024,
      rollupOptions: {
        input: resolvePath(entryDir, 'index.html'),
      },
    },
  })

  const htmlPath = resolvePath(outDir, 'index.html')
  if (!existsSync(htmlPath)) {
    log.error(`MCP App build for "${app.name}" produced no index.html at ${htmlPath}`)
    throw new Error(`MCP App build for "${app.name}" failed.`)
  }

  return readFile(htmlPath, 'utf-8')
}
