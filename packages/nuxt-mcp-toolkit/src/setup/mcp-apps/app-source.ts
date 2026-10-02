import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { posix } from 'node:path'
import type { Plugin } from 'vite'
import { injectSfcAutoImports } from './parse-sfc'

interface AppSourceOptions {
  entryDir: string
  /** The SFC that `App.vue` in `entryDir` was generated from. */
  sfc: string
  rootDir: string
}

const TS_SCRIPT_RE = /<script\s[^>]*lang=["']tsx?["']/

const toPosix = (path: string) => path.replaceAll('\\', '/')
const cleanId = (id: string) => id.replace(/[?#].*$/, '')

function isWithin(dir: string, file: string): boolean {
  const rel = posix.relative(dir, file)
  return !rel.startsWith('..') && !posix.isAbsolute(rel)
}

/** Nuxt aliases that point into the app's own source, rather than Nuxt's runtime or build output. */
export function appSourceAliases(alias: Record<string, string>, rootDir: string, buildDir: string): Record<string, string> {
  const root = toPosix(rootDir)
  const build = toPosix(buildDir)
  const out: Record<string, string> = {}
  for (const [find, target] of Object.entries(alias)) {
    const path = toPosix(target).replace(/\/$/, '')
    if (isWithin(root, path) && !isWithin(build, path) && !path.split('/').includes('node_modules')) out[find] = path
  }
  return out
}

/**
 * Treat modules the app imports from its own source like the app SFC: ids in the generated
 * `App.vue` and `entry.ts` resolve from the original SFC and `rootDir`, and SFCs get the auto-imports.
 * TypeScript SFCs are served under `entryDir`: in a build, plugin-vue lets oxc pick the nearest
 * tsconfig, which in a Nuxt 4 app references `.nuxt/tsconfig.app.json` before Nuxt writes it.
 */
export function appSourcePlugin(options: AppSourceOptions): Plugin {
  const entryDir = toPosix(options.entryDir)
  const rootDir = toPosix(options.rootDir)
  const appVue = posix.join(entryDir, 'App.vue')
  const entryTs = posix.join(entryDir, 'entry.ts')
  const nestedDir = posix.join(entryDir, '__nested__')
  const originals = new Map<string, string>()

  const isAppSource = (file: string) =>
    isWithin(rootDir, file) && !isWithin(entryDir, file) && !file.split('/').includes('node_modules')

  function originalImporter(importer: string): string | undefined {
    const file = cleanId(importer)
    if (file === appVue) return toPosix(options.sfc)
    if (file === entryTs) return posix.join(rootDir, 'entry.ts')
    return originals.get(file)
  }

  return {
    name: 'mcp-toolkit:app-source',
    enforce: 'pre',
    async resolveId(source, importer, resolveOptions) {
      if (!importer || source.startsWith('\0') || /[?&]vue\b/.test(source)) return null
      if (cleanId(importer) === entryTs && source === './App.vue') return null
      const original = originalImporter(importer)
      if (original === undefined && !cleanId(source).endsWith('.vue')) return null

      const resolved = await this.resolve(source, original ?? importer, { ...resolveOptions, skipSelf: true })
      if (!resolved || resolved.external || !resolved.id.endsWith('.vue') || !isAppSource(resolved.id)) return resolved
      if (!TS_SCRIPT_RE.test(await readFile(resolved.id, 'utf-8'))) return resolved

      const hash = createHash('sha256').update(resolved.id).digest('hex').slice(0, 8)
      const nested = posix.join(nestedDir, hash, posix.basename(resolved.id))
      originals.set(nested, resolved.id)
      return nested
    },
    load(id) {
      const original = originals.get(id)
      return original === undefined ? null : readFile(original, 'utf-8')
    },
    async transform(code, id) {
      if (!id.endsWith('.vue')) return null
      const file = originals.get(id) ?? id
      return isAppSource(file) ? injectSfcAutoImports(code, file) : null
    },
  }
}
