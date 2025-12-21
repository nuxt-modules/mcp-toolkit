import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'my_tool',
  title: 'My Tool',
  description: 'A test tool for default handler testing',
  inputSchema: {
    message: z.string().describe('A test message'),
  },
  handler: async ({ message }) => {
    return {
      content: [
        {
          type: 'text',
          text: `My tool says: ${message}`,
        },
      ],
    }
  },
})
