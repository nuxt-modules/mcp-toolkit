import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'

function isEvlogNuxtModuleRegistered(nuxt: Pick<Nuxt, 'options'>): boolean {
  const modules = nuxt.options.modules
  if (!Array.isArray(modules)) return false
  return modules.some((entry) => {
    const name = typeof entry === 'string'
      ? entry
      : Array.isArray(entry) && typeof entry[0] === 'string'
        ? entry[0]
        : null
    if (!name) return false
    return name === 'evlog/nuxt'
      || name.endsWith('/evlog/nuxt')
      || name.endsWith('\\evlog\\nuxt')
  })
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function deriveMcpService(options: ModuleOptions, evlogCfg: Record<string, unknown>): string {
  const env = evlogCfg.env as { service?: string } | undefined
  if (env?.service) return `${env.service}/mcp`
  const slug = options.name ? slugify(options.name) : ''
  return slug || 'mcp'
}

function applyDefaultRouteService(nuxt: Nuxt, options: ModuleOptions): void {
  const route = (options.route ?? '/mcp').replace(/\/+$/, '')
  const exactKey = route
  const subKey = `${route}/**`

  const evlogCfg = (nuxt.options.runtimeConfig.evlog ?? {}) as Record<string, unknown>
  const routes = (evlogCfg.routes as Record<string, { service?: string }> | undefined) ?? {}

  const desiredService
    = routes[exactKey]?.service
      ?? routes[subKey]?.service
      ?? deriveMcpService(options, evlogCfg)

  // evlog compiles `/mcp/**` to `^/mcp/.*$` — the exact key is needed
  // for the default `/mcp` handler, the `/**` key for nested handlers.
  const next: Record<string, { service?: string }> = {}
  next[subKey] = { ...routes[subKey], service: routes[subKey]?.service ?? desiredService }
  next[exactKey] = { ...routes[exactKey], service: routes[exactKey]?.service ?? desiredService }
  for (const [pattern, value] of Object.entries(routes)) {
    if (pattern === exactKey || pattern === subKey) continue
    next[pattern] = value
  }

  evlogCfg.routes = next
  nuxt.options.runtimeConfig.evlog = evlogCfg
}

export function setupEvlog(nuxt: Nuxt, options: ModuleOptions): void {
  if (options.logging === false) return

  const evlogNuxtRegistered = isEvlogNuxtModuleRegistered(nuxt)

  if (options.logging === true && !evlogNuxtRegistered) {
    throw new Error(
      '[@nuxtjs/mcp-toolkit] `mcp.logging` is enabled but `evlog/nuxt` is not registered. '
      + 'Install `evlog` and add `\'evlog/nuxt\'` to `modules` in nuxt.config, '
      + 'or set `mcp.logging: false` to opt out.',
    )
  }

  if (!evlogNuxtRegistered) return

  nuxt.hook('modules:done', () => applyDefaultRouteService(nuxt, options))
}
