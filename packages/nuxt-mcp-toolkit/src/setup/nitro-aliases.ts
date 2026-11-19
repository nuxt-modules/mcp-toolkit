import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { directoryToURL, tryResolveModule } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'

export interface NitroAliasesHandle {
  /** Whether the resolved Nitro preset targets Cloudflare Workers. */
  isCloudflare(): boolean
}

/**
 * Register the cross-cutting Nitro tweaks the module needs:
 *
 * 1. **Cloudflare alias** — swap the Code Mode executor for the Workers
 *    variant when the preset targets Cloudflare. Also tracks the preset
 *    so the transport template can pick the right provider.
 * 2. **Force `h3` resolution through nitropack** — when pnpm hoists the
 *    module's `h3` peer dependency to v2 while Nitro still ships v1,
 *    Rollup may pick v2 for ALL h3 imports and break Nitro internals.
 *    Nitro v2 only.
 * 3. **Mark `secure-exec` as external** — it is an optional lazy-loaded
 *    dependency for Code Mode and must never be bundled.
 */
export function setupNitroAliases(nuxt: Nuxt, resolver: Resolver): NitroAliasesHandle {
  let isCloudflare = false

  nuxt.hook('nitro:config', async (nitroConfig) => {
    const preset = String(nitroConfig.preset || process.env.NITRO_PRESET || '')
    const cfPreset = preset.includes('cloudflare')
    if (cfPreset) {
      nitroConfig.alias ??= {}
      const executorPath = resolver.resolve('runtime/server/mcp/codemode/executor')
      nitroConfig.alias[executorPath] = resolver.resolve('runtime/server/mcp/codemode/executor.cloudflare')
    }
    if (!nuxt.options.dev) {
      isCloudflare = cfPreset
    }

    await forceH3ResolutionViaNitropack(nuxt.options.appDir, nitroConfig)
    markSecureExecExternal(nitroConfig)
  })

  return { isCloudflare: () => isCloudflare }
}

export async function forceH3ResolutionViaNitropack(appDir: string, nitroConfig: NitroConfig): Promise<void> {
  // Nuxt 3.20+ / 4.2+ build the server in `@nuxt/nitro-server`; earlier versions in `nuxt` itself.
  const nuxtDir = directoryToURL(appDir)
  const serverPkgPath = await tryResolveModule('@nuxt/nitro-server/package.json', nuxtDir)
    ?? await tryResolveModule('nuxt/package.json', nuxtDir)
  if (!serverPkgPath) {
    throw new Error(`[@nuxtjs/mcp-toolkit] Could not resolve the Nuxt package from ${appDir}`)
  }
  // Nitro v3 (Nuxt 5) runs on h3 v2: an alias to the h3 v1 of a hoisted `nitropack` would break it.
  const serverPkg: { dependencies?: Record<string, string> } = JSON.parse(await readFile(serverPkgPath, 'utf8'))
  if (!serverPkg.dependencies?.nitropack) {
    return
  }
  const nitroPkgPath = createRequire(serverPkgPath).resolve('nitropack/package.json')
  nitroConfig.alias ??= {}
  nitroConfig.alias.h3 ??= createRequire(nitroPkgPath).resolve('h3')
}

function markSecureExecExternal(nitroConfig: NitroConfig): void {
  nitroConfig.externals ??= {}
  nitroConfig.externals.external ??= []
  nitroConfig.externals.external.push('secure-exec')

  nitroConfig.rollupConfig ??= {}
  if (Array.isArray(nitroConfig.rollupConfig.external)) {
    nitroConfig.rollupConfig.external.push('secure-exec')
  }
  else if (!nitroConfig.rollupConfig.external) {
    nitroConfig.rollupConfig.external = ['secure-exec']
  }
}
