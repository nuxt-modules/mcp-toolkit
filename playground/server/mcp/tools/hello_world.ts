import { z } from 'zod'

export default defineMcpTool({
  title: 'Hello World',
  name: 'hello_world',
  description: 'An example custom tool to test auto-detection',
  inputSchema: {
    message: z.string().describe('A message to echo back'),
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
