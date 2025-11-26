import { defineMcpTool } from '../../../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'override_tool',
  title: 'Overridden Tool',
  description: 'This tool overrides the base tool',
  inputSchema: {
    input: z.string().describe('Test input string'),
  },
  handler: async ({ input }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Overridden result: ${input}`,
        },
      ],
    }
  },
})
