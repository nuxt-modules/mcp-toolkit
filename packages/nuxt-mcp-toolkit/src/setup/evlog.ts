import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
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
 * union and report whether `evlog` can be loaded from the Nuxt project root.
 */
export function resolveLoggingMode(options: ModuleOptions, rootDir: string): LoggingMode {
  if (options.logging === false) {
    return { kind: 'off', explicit: true }
  }

  const evlogAvailable = isEvlogResolvableFromProject(rootDir)

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

function isEvlogResolvableFromProject(rootDir: string): boolean {
  try {
    const moduleRequire = createRequire(join(rootDir, 'package.json'))
    moduleRequire.resolve('evlog/nitro')
    return true
  }
  catch {
    return false
  }
}

/** True when the app declares `evlog` — avoids hoisted-deps false positives in monorepos. */
function isEvlogDeclaredInProject(rootDir: string): boolean {
  try {
    const raw = readFileSync(join(rootDir, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    return Boolean(
      pkg.dependencies?.evlog
      || pkg.devDependencies?.evlog
      || pkg.optionalDependencies?.evlog
      || pkg.peerDependencies?.evlog,
    )
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
 * Wire evlog into the user's Nitro app when observability is on and evlog is
 * resolvable from the project. Otherwise silent; warns when the app declares
 * `evlog` but `mcp.logging: false`; throws when logging is forced on without a
 * resolvable `evlog`.
 */
export async function setupEvlog(
  nuxt: Nuxt,
  options: ModuleOptions,
  log: ConsolaInstance,
): Promise<void> {
  const rootDir = nuxt.options.rootDir
  const mode = resolveLoggingMode(options, rootDir)

  if (mode.kind === 'forced' && !mode.evlogAvailable) {
    throw new Error(
      '[@nuxtjs/mcp-toolkit] `mcp.logging` is enabled but `evlog` is not installed (or not resolvable from your app). '
      + 'Run `pnpm add evlog` (or `npm install evlog` / `yarn add evlog` / `bun add evlog`), '
      + 'or set `mcp.logging: false` to opt out.',
    )
  }

  if (mode.kind === 'off') {
    if (isEvlogDeclaredInProject(rootDir)) {
      log.warn(
        '[@nuxtjs/mcp-toolkit] `evlog` is listed in package.json but MCP observability is off (`mcp.logging: false`). '
        + 'Remove `mcp.logging` or set it to `true` / an options object to enable wide-event tracing on your MCP route.',
      )
    }
    return
  }

  if (!mode.evlogAvailable) {
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
