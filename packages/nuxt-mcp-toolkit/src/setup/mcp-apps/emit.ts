import { mkdir, writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { Resolver } from '@nuxt/kit'
import type { DiscoveredApp } from './discover'
import type { ParsedSfcApp } from './parse-sfc'

/**
 * Emit the three TS modules backing one MCP App:
 *   `<name>.app.ts`      — `defineMcpApp({ ...args })`
 *   `<name>.tool.ts`     — wraps it as a registerable tool
 *   `<name>.resource.ts` — wraps it as a `ui://` resource
 *
 * HTML is base64-embedded so the modules survive any deployment target.
 */
export async function emitAppModules(
  app: DiscoveredApp,
  parsed: ParsedSfcApp,
  bundledHtml: string,
  outDir: string,
  resolver: Resolver,
): Promise<{ toolFile: string, resourceFile: string }> {
  await mkdir(outDir, { recursive: true })

  // Absolute paths sidestep the `@nuxtjs/mcp-toolkit/server` subpath import:
  // in dev the toolkit is only stub-built so bare specifiers would break.
  const appsModule = JSON.stringify(resolver.resolve('runtime/server/mcp/definitions/apps'))
  const importsBlock = parsed.imports.length ? `${parsed.imports.join('\n')}\n\n` : ''
  const html64 = JSON.stringify(Buffer.from(bundledHtml, 'utf-8').toString('base64'))

  const appFileBody = `import { defineMcpApp } from ${appsModule}
${importsBlock}
export default defineMcpApp(${parsed.argText})
`

  const toolFileBody = `import _app from './${app.name}.app'
import { _createAppTool } from ${appsModule}

const __HTML = Buffer.from(${html64}, 'base64').toString('utf-8')

export default _createAppTool(_app, { name: ${JSON.stringify(app.name)}, html: __HTML })
`

  const resourceFileBody = `import _app from './${app.name}.app'
import { _createAppResource } from ${appsModule}

const __HTML = Buffer.from(${html64}, 'base64').toString('utf-8')

export default _createAppResource(_app, { name: ${JSON.stringify(app.name)}, html: __HTML })
`

  const appFile = resolvePath(outDir, `${app.name}.app.ts`)
  const toolFile = resolvePath(outDir, `${app.name}.tool.ts`)
  const resourceFile = resolvePath(outDir, `${app.name}.resource.ts`)

  await writeFile(appFile, appFileBody, 'utf-8')
  await writeFile(toolFile, toolFileBody, 'utf-8')
  await writeFile(resourceFile, resourceFileBody, 'utf-8')

  return { toolFile, resourceFile }
}
