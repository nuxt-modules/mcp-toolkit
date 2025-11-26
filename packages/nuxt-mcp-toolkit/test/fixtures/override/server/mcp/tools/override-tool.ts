import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'override_tool',
  title: 'Override Tool',
  description: 'A tool that will be overridden by the layer',
  inputSchema: {
    input: z.string().describe('Test input string'),
  },
  handler: async ({ input }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Base result: ${input}`,
        },
      ],
    }
  },
})
