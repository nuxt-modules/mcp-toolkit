import { useRuntimeConfig } from '#imports'
import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'inspect_routes',
  description: 'Returns evlog routes seen by Nitro at runtime',
  inputSchema: {},
  handler: async () => {
    const config = useRuntimeConfig() as unknown as { evlog?: { routes?: Record<string, { service?: string }> } }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(config.evlog?.routes ?? {}),
        },
      ],
    }
  },
})
