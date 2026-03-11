import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'echo_tool',
  description: 'Echo a message',
  inputSchema: {
    message: z.string().describe('Message to echo'),
  },
  handler: async ({ message }) => ({
    content: [{
      type: 'text',
      text: `Echo: ${message}`,
    }],
  }),
})
