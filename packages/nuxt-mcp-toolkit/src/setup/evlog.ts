import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
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

export function setupEvlog(
  nuxt: Nuxt,
  options: ModuleOptions,
  log: ConsolaInstance,
): void {
  if (options.logging === false) return

  const evlogNuxtRegistered = isEvlogNuxtModuleRegistered(nuxt)

  if (options.logging === true && !evlogNuxtRegistered) {
    throw new Error(
      '[@nuxtjs/mcp-toolkit] `mcp.logging` is enabled but `evlog/nuxt` is not registered. '
      + 'Install `evlog` and add `\'evlog/nuxt\'` to `modules` in nuxt.config, '
      + 'or set `mcp.logging: false` to opt out.',
    )
  }

  if (evlogNuxtRegistered) {
    log.info(`Observability enabled · evlog wide events on \`${options.route ?? '/mcp'}\``)
  }
}
