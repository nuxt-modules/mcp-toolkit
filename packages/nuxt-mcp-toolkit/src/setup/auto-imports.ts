import { addComponent, addServerImports } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'

const DEFINITION_HELPERS = [
  'defineMcpTool', 'defineMcpResource', 'defineMcpPrompt', 'defineMcpPlugins',
  'createMcpHandler', 'createMcpOAuth', 'imageResult', 'audioResult', 'toolResult',
  'inputRequired', 'mcpElicit', 'mcpElicitUrl', 'getElicitedContent', 'getInputResponses',
  'getMissingInputs', 'canRequestInput', 'getSupportedInputs', 'defineRequestState', 'McpJsonRpcError',
] as const

const DEFINITION_TYPES = ['McpEvent', 'McpTool', 'McpResource', 'McpPrompt', 'McpHandler', 'McpHandlerOptions'] as const

/** Register module auto-imports — definition helpers, types, and the `<InstallButton>` component. */
export function setupAutoImports(resolver: Resolver): void {
  const definitionsPath = resolver.resolve('runtime/server')

  addComponent({
    name: 'InstallButton',
    filePath: resolver.resolve('runtime/components/InstallButton.vue'),
  })

  addServerImports(DEFINITION_HELPERS.map(name => ({ name, from: definitionsPath })))
  addServerImports(DEFINITION_TYPES.map(name => ({ name, from: definitionsPath, type: true })))
}
