import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useEvent } from 'nitropack/runtime'

export default defineMcpTool({
  name: 'context_tool',
  title: 'Context Tool',
  description: 'A tool that reads context set by middleware',
  inputSchema: {},
  handler: async () => {
    const event = useEvent()

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            userId: event.context.userId || 'no-user',
            middlewareExecuted: event.context.middlewareExecuted || false,
          }),
        },
      ],
    }
  },
})
