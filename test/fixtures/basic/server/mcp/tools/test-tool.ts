import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'test_tool',
  title: 'Test Tool',
  description: 'A simple test tool for MCP testing',
  inputSchema: {
    input: z.string().describe('Test input string'),
  },
  handler: async ({ input }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Test result: ${input}`,
        },
      ],
    }
  },
})
