import { addComponent, addServerImports } from '@nuxt/kit'
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
] as const

const DEFINITION_TYPES = [
  'McpRequestExtra',
  'McpToolExtra',
  'McpPromptExtra',
  'McpResourceExtra',
] as const

/**
 * Register all auto-imports exposed by the module — definition helpers,
 * MCP-specific types, server composables and the Vue `<InstallButton>`.
 *
 * Skipped entirely when `autoImports: false` so users can opt into
 * explicit `@nuxtjs/mcp-toolkit/server` imports.
 */
export function setupAutoImports(resolver: Resolver): void {
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
}
