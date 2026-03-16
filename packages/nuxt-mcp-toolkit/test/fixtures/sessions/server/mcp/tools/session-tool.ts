import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'session_tool',
  description: 'A tool for testing session management',
  inputSchema: {
    message: z.string().describe('Input message'),
  },
  handler: async ({ message }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Echo: ${message}`,
        },
      ],
    }
  },
})
