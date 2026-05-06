import { addServerTemplate } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'
import type { DiscoveredApp } from './discover'
import type { ParsedSfcApp } from './parse-sfc'

export interface ResolvedAttribution {
  /** Final `attachTo` value (explicit override > sub-folder > `'apps'`). */
  attachTo: string
  /** Final `group` value (explicit override > resolved `attachTo`). */
  group: string
}

/**
 * Emit the three TS modules backing one MCP App:
 *   `<name>.app.ts`      — `defineMcpApp({ ...args })`
 *   `<name>.tool.ts`     — wraps it as a registerable tool
 *   `<name>.resource.ts` — wraps it as a `ui://` resource
 *
 * HTML is base64-embedded so the modules survive any deployment target.
 */
export function emitAppModules(
  app: DiscoveredApp,
  parsed: ParsedSfcApp,
  bundledHtml: string,
  attribution: ResolvedAttribution,
  resolver: Resolver,
): { toolFile: string, resourceFile: string } {
  // Absolute paths sidestep the `@nuxtjs/mcp-toolkit/server` subpath import:
  // in dev the toolkit is only stub-built so bare specifiers would break.
  const appsModule = JSON.stringify(resolver.resolve('runtime/server/mcp/definitions/apps'))
  const runtimeImports = parsed.imports.filter(text => !/^\s*import\s+type\b/.test(text))
  const importsBlock = runtimeImports.length ? `${runtimeImports.join('\n')}\n\n` : ''
  const html64 = JSON.stringify(Buffer.from(bundledHtml, 'utf-8').toString('base64'))
  const argText = stripTypeScriptFromMacroArg(parsed.argText)

  // Inject resolved `attachTo` / `group` as DEFAULTS — the user's literal
  // override (already statically extracted) wins via the spread that follows.
  const defaultsBlock = `attachTo: ${JSON.stringify(attribution.attachTo)},\n  group: ${JSON.stringify(attribution.group)},\n  `
  const mergedArgs = `{\n  ${defaultsBlock}...(${argText}),\n}`

  const appFileBody = `import { defineMcpApp } from ${appsModule}
${importsBlock}
export default defineMcpApp(${mergedArgs})
`

  const toolFileBody = `import { defineMcpApp, _createAppTool } from ${appsModule}
${importsBlock}

const __HTML = Buffer.from(${html64}, 'base64').toString('utf-8')
const _app = defineMcpApp(${mergedArgs})

export default _createAppTool(_app, { name: ${JSON.stringify(app.name)}, html: __HTML })
`

  const resourceFileBody = `import { defineMcpApp, _createAppResource } from ${appsModule}
${importsBlock}

const __HTML = Buffer.from(${html64}, 'base64').toString('utf-8')
const _app = defineMcpApp(${mergedArgs})

export default _createAppResource(_app, { name: ${JSON.stringify(app.name)}, html: __HTML })
`

  const appFile = `#nuxt-mcp-toolkit/mcp-apps/${app.name}.app.mjs`
  const toolFile = `#nuxt-mcp-toolkit/mcp-apps/${app.name}.tool.mjs`
  const resourceFile = `#nuxt-mcp-toolkit/mcp-apps/${app.name}.resource.mjs`

  addServerTemplate({ filename: appFile, getContents: () => appFileBody })
  addServerTemplate({ filename: toolFile, getContents: () => toolFileBody })
  addServerTemplate({ filename: resourceFile, getContents: () => resourceFileBody })

  return { toolFile, resourceFile }
}

function stripTypeScriptFromMacroArg(argText: string): string {
  return argText.replace(/\):[^=\n]*=>/g, ') =>')
}
