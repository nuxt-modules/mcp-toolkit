import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

// name and title are auto-generated from filename
export default defineMcpPrompt({
  description: 'Generate a greeting message',
  handler: async () => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'Hello!',
        },
      }],
    }
  },
})
