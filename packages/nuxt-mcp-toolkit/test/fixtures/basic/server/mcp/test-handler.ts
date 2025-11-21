import { z } from 'zod'
import { defineMcpHandler, defineMcpTool } from '../../../../../src/runtime/server/types'

const testHandlerTool = defineMcpTool({
  name: 'test_handler_tool',
  title: 'Test Handler Tool',
  description: 'A tool for testing custom handlers',
  inputSchema: {
    message: z.string().describe('A message to echo back'),
  },
  handler: async ({ message }) => {
    return {
      content: [{
        type: 'text',
        text: `Handler echo: ${message}`,
      }],
    }
  },
})

export default defineMcpHandler({
  name: 'test_handler',
  version: '1.0.0',
  tools: [testHandlerTool],
})
