import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  name: 'test_prompt',
  title: 'Test Prompt',
  description: 'A simple test prompt for MCP testing',
  handler: async () => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'This is a test prompt message',
        },
      }],
    }
  },
})
