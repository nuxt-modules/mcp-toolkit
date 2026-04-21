import { createRequire } from 'node:module'
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
 * 3. **Mark `secure-exec` as external** — it is an optional lazy-loaded
 *    dependency for Code Mode and must never be bundled.
 */
export function setupNitroAliases(nuxt: Nuxt, resolver: Resolver): NitroAliasesHandle {
  let isCloudflare = false

  nuxt.hook('nitro:config', (nitroConfig) => {
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

    forceH3ResolutionViaNitropack(nitroConfig)
    markSecureExecExternal(nitroConfig)
  })

  return { isCloudflare: () => isCloudflare }
}

function forceH3ResolutionViaNitropack(nitroConfig: NitroConfig): void {
  try {
    const _require = createRequire(import.meta.url)
    const nitroPkgPath = _require.resolve('nitropack/package.json')
    const h3Path = createRequire(nitroPkgPath).resolve('h3')
    nitroConfig.alias ??= {}
    nitroConfig.alias.h3 ??= h3Path
  }
  catch {
    // nitropack not installed in this layout — skip silently. The default
    // h3 resolution is fine when the version mismatch doesn't apply.
  }
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
