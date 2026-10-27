import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import type { McpModuleOptions } from '../../src/module/options.ts'

const root = normalize(fileURLToPath(new URL('../fixtures/composition/', import.meta.url)))

export const composedOptions = {
  route: '/composed/mcp',
  dir: [join(root, 'app'), join(root, 'base')],
  include: {
    tools: ['#composition/generated.ts'],
    resources: ['#composition/included-resource.ts'],
    prompts: ['#composition/included-prompt.ts'],
    plugins: ['#composition/plugins.ts'],
  },
  session: { enabled: true, maxSessions: 10 },
  logging: true,
  limits: { maxBodySize: 8192 },
} satisfies McpModuleOptions

export const composedVirtual = {
  '#composition/generated.ts': `
import { defineMcpTool } from 'nitro-mcp-toolkit'
export default defineMcpTool({ handler: () => 'generated' })
`,
  '#composition/included-resource.ts': `
import { defineMcpResource } from 'nitro-mcp-toolkit'
export default defineMcpResource({ uri: 'docs://included', handler: () => 'Included resource' })
`,
  '#composition/included-prompt.ts': `
import { defineMcpPrompt } from 'nitro-mcp-toolkit'
export default defineMcpPrompt({ handler: () => 'Included prompt' })
`,
  '#composition/plugins.ts': `
import { defineMcpPlugins } from 'nitro-mcp-toolkit'
export default defineMcpPlugins([{ id: 'fixture/generated', settings: () => ({ enabled: true }) }])
`,
}
