import { z } from 'zod'

export default defineMcpTool({
  name: 'example_tool',
  title: 'Example Tool',
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
