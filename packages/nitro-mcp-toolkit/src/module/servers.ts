import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { renderServers, renderServerTypes } from './template.ts'
import type { Nitro } from 'nitro/types'

export const SERVERS_SPECIFIER = 'nitro-mcp-toolkit/servers'

export interface McpServerInstance {
  route: string
  slug: string
  exportName: string
  handlerId: string
}

const instances = new WeakMap<Nitro, McpServerInstance[]>()
const watching = new WeakSet<Nitro>()
const pendingPatch = new WeakMap<Nitro, ReturnType<typeof setTimeout>>()

/** `/admin/mcp` becomes `admin-mcp`, so two instances get distinct module ids. */
export function slugify(route: string): string {
  return (
    route
      .replace(/^\//, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase() || 'root'
  )
}

/** `admin-mcp` becomes `adminMcp`, the name a route imports from `/servers`. */
export function exportName(slug: string): string {
  const camel = slug.replace(/-([a-z0-9])/gi, (_, character: string) => character.toUpperCase())
  return /^[A-Za-z_$]/.test(camel) ? camel : `_${camel}`
}

function typesDir(nitro: Nitro): string {
  return join(
    nitro.options.rootDir,
    nitro.options.typescript.generatedTypesDir || 'node_modules/.nitro/types',
  )
}

async function writeServerTypes(nitro: Nitro): Promise<void> {
  const list = instances.get(nitro)
  if (!list?.length) return

  const dir = typesDir(nitro)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'mcp-servers.d.ts'), renderServerTypes(list))
}

async function patchNitroDts(nitro: Nitro): Promise<boolean> {
  const dts = join(typesDir(nitro), 'nitro.d.ts')
  const reference = '/// <reference path="./mcp-servers.d.ts" />'

  try {
    const current = await readFile(dts, 'utf8')
    if (!current.includes(reference)) {
      await writeFile(dts, `${reference}\n${current}`)
    }
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
}

function schedulePatch(nitro: Nitro, attempt = 0): void {
  const previous = pendingPatch.get(nitro)
  if (previous !== undefined) clearTimeout(previous)

  pendingPatch.set(
    nitro,
    setTimeout(
      () => {
        pendingPatch.delete(nitro)
        void patchNitroDts(nitro).then((done) => {
          if (!done && attempt < 5) schedulePatch(nitro, attempt + 1)
        })
      },
      attempt === 0 ? 0 : 20,
    ),
  )
}

/**
 * Record this instance on the barrel `nitro-mcp-toolkit/servers`. That id is a
 * virtual, not an alias of `#mcp/servers`: Rolldown's `resolve.alias` does not
 * call other plugins' `resolveId`, so an alias to a virtual never loads.
 * Two routes that camelCase to the same name throw, the same way two servers
 * on one route do.
 */
export function registerServer(
  nitro: Nitro,
  instance: Omit<McpServerInstance, 'exportName'>,
): McpServerInstance {
  const name = exportName(instance.slug)
  const list = instances.get(nitro) ?? []
  const collision = list.find((entry) => entry.exportName === name)

  if (collision) {
    throw new Error(
      `[nitro-mcp-toolkit] ${instance.route} and ${collision.route} both export as \`${name}\`. ` +
        'Give one of them a different `route`.',
    )
  }

  const registered = { ...instance, exportName: name }
  list.push(registered)
  instances.set(nitro, list)

  nitro.options.virtual[SERVERS_SPECIFIER] = () => renderServers(list)

  if (!watching.has(nitro)) {
    watching.add(nitro)
    nitro.hooks.hook('close', () => {
      const timer = pendingPatch.get(nitro)
      if (timer !== undefined) clearTimeout(timer)
    })
    nitro.hooks.hook('types:extend', async () => {
      await writeServerTypes(nitro)
      schedulePatch(nitro)
    })
  }

  return registered
}
