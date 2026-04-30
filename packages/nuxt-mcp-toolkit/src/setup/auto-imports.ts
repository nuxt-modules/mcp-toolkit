import { addComponent, addImports, addServerImports } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'

const DEFINITION_HELPERS = [
  'defineMcpTool',
  'defineMcpResource',
  'defineMcpPrompt',
  'defineMcpHandler',
  'textResult',
  'jsonResult',
  'errorResult',
  'imageResult',
  'audioResult',
  'completable',
  'extractToolNames',
  'listMcpTools',
  'listMcpResources',
  'listMcpPrompts',
  'listMcpDefinitions',
] as const

const DEFINITION_TYPES = [
  'McpRequestExtra',
  'McpToolExtra',
  'McpPromptExtra',
  'McpResourceExtra',
] as const

export interface AutoImportsConfig {
  /** Register `defineMcpApp` (server) + `useMcpApp` (client). Skipped when no `app/mcp/*.vue` exists. */
  hasApps?: boolean
}

/** Register module auto-imports — definition helpers, types, and the `<InstallButton>` component. */
export function setupAutoImports(resolver: Resolver, config: AutoImportsConfig = {}): void {
  const definitionsPath = resolver.resolve('runtime/server/mcp/definitions')
  const sessionPath = resolver.resolve('runtime/server/mcp/session')
  const serverPath = resolver.resolve('runtime/server/mcp/server')
  const elicitationPath = resolver.resolve('runtime/server/mcp/elicitation')
  const loggerPath = resolver.resolve('runtime/server/mcp/logger')

  addComponent({
    name: 'InstallButton',
    filePath: resolver.resolve('runtime/components/InstallButton.vue'),
  })

  addServerImports(DEFINITION_HELPERS.map(name => ({ name, from: definitionsPath })))
  addServerImports(DEFINITION_TYPES.map(name => ({ name, from: definitionsPath, type: true })))

  addServerImports([
    { name: 'useMcpSession', from: sessionPath },
    { name: 'invalidateMcpSession', from: sessionPath },
    { name: 'useMcpServer', from: serverPath },
    { name: 'useMcpElicitation', from: elicitationPath },
    { name: 'useMcpLogger', from: loggerPath },
  ])

  // Registered only when at least one `app/mcp/*.vue` exists, so projects
  // without MCP Apps keep a clean Nuxt namespace.
  if (config.hasApps) {
    addServerImports([{ name: 'defineMcpApp', from: definitionsPath }])
    addImports({ name: 'useMcpApp', from: resolver.resolve('runtime/app/use-mcp-app') })
  }
}
