import { createRequire } from 'node:module'
import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import type { NitroModule } from 'nitropack'
import type { ModuleOptions } from '../module'

/**
 * Three-state union derived from the user's `mcp.logging` setting.
 * Replaces the previous tangle of four booleans (`loggingExplicit`,
 * `loggingForcedOff`, `loggingForcedOn`, `loggingActive`).
 */
export type LoggingMode
  = | { kind: 'off', explicit: boolean }
    | { kind: 'auto-detect', evlogAvailable: boolean }
    | { kind: 'forced', options: Record<string, unknown>, evlogAvailable: boolean }

/**
 * Resolve the user's `mcp.logging` option into a single discriminated
 * union and report whether evlog is installed.
 */
export function resolveLoggingMode(options: ModuleOptions): LoggingMode {
  if (options.logging === false) {
    return { kind: 'off', explicit: true }
  }

  const evlogAvailable = isEvlogAvailable()

  if (options.logging === true) {
    return { kind: 'forced', options: {}, evlogAvailable }
  }

  if (typeof options.logging === 'object' && options.logging !== null) {
    return {
      kind: 'forced',
      options: options.logging as Record<string, unknown>,
      evlogAvailable,
    }
  }

  return { kind: 'auto-detect', evlogAvailable }
}

function isEvlogAvailable(): boolean {
  try {
    const moduleRequire = createRequire(import.meta.url)
    moduleRequire.resolve('evlog/nitro')
    return true
  }
  catch {
    return false
  }
}

/**
 * Wrap an evlog Nitro module so its `noExternals: true` flag is rolled back
 * after setup. evlog forces bundling of its runtime, but that flag also
 * tries to bundle every other dependency (`drizzle-kit`, native modules, …)
 * which breaks integrations like `@nuxthub/core`.
 *
 * We just need evlog's *own* package inlined, so we reset the global flag
 * and add evlog to the inline list instead. The MCP-specific context
 * tagging happens directly in `createMcpHandler` (see
 * `runtime/server/mcp/utils`), so we don't need a separate Nitro plugin
 * here — that avoids ordering issues with evlog's own request hook.
 */
function wrapEvlogModule(evlogModule: NitroModule): NitroModule {
  return {
    name: 'evlog',
    async setup(nitro) {
      const previousNoExternals = nitro.options.noExternals
      await evlogModule.setup?.(nitro)
      nitro.options.noExternals = previousNoExternals ?? false
      // Nitro types `externals` as required, but in practice it is initialised
      // by the build pipeline; we only need to mutate `.inline` here.
      const externals = (nitro.options.externals ?? {}) as { inline?: string[] }
      externals.inline = Array.from(new Set([
        ...(externals.inline ?? []),
        'evlog',
        'evlog/nitro',
      ]))
      nitro.options.externals = externals as typeof nitro.options.externals
    },
  }
}

/**
 * Wire evlog into the user's Nitro app, log a status line for the dev
 * server, and bail loudly if `logging` was forced on without the
 * peer dep installed.
 */
export async function setupEvlog(
  nuxt: Nuxt,
  options: ModuleOptions,
  log: ConsolaInstance,
): Promise<void> {
  const mode = resolveLoggingMode(options)

  if (mode.kind === 'forced' && !mode.evlogAvailable) {
    throw new Error(
      '[@nuxtjs/mcp-toolkit] `mcp.logging` is enabled but the optional `evlog` peer dependency is not installed. '
      + 'Run `pnpm add evlog` (or `npm install evlog` / `yarn add evlog` / `bun add evlog`) to enable server-side observability, '
      + 'or set `mcp.logging: false` to opt out.',
    )
  }

  if (mode.kind === 'off') {
    log.info('Observability disabled (`mcp.logging: false`) · `useMcpLogger().notify` still active')
    return
  }

  if (!mode.evlogAvailable) {
    log.info('Observability inactive · install `evlog` to enable wide-event tracing — `useMcpLogger().notify` still works')
    return
  }

  const { default: evlogNitro } = await import('evlog/nitro') as typeof import('evlog/nitro')
  const loggingOptions = mode.kind === 'forced' ? mode.options : {}
  const { service, env: rawEnv, ...evlogOptions } = loggingOptions as {
    service?: string
    env?: Record<string, unknown>
    [key: string]: unknown
  }
  const resolvedService = service ?? options.name ?? 'mcp-server'

  const evlogModule = evlogNitro({
    ...evlogOptions,
    env: {
      ...rawEnv,
      service: (rawEnv as { service?: string } | undefined)?.service ?? resolvedService,
    },
  })

  const wrapped = wrapEvlogModule(evlogModule)

  nuxt.hook('nitro:config', (nitroConfig) => {
    nitroConfig.modules ??= []
    const alreadyRegistered = nitroConfig.modules.some(
      m => typeof m === 'object' && m !== null && 'name' in m && (m as { name?: string }).name === 'evlog',
    )
    if (!alreadyRegistered) {
      nitroConfig.modules.push(wrapped)
    }
  })

  log.info(`Observability enabled · evlog wide events on \`${options.route ?? '/mcp'}\``)
}
