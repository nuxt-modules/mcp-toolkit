import { defineMcpTool } from '../../../../../../src/runtime/server/index'
import { z } from 'zod'

export default defineMcpTool({
  name: 'echo_tool',
  title: 'Echo Tool',
  description: 'Echoes back the provided message',
  inputSchema: z.object({
    message: z.string().describe('Message to echo'),
  }),
  handler: async ({ message }) => {
    return {
      content: [{ type: 'text', text: message }],
    }
  },
})
