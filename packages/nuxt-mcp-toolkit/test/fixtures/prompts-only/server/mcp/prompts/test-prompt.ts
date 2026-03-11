import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  name: 'test_prompt',
  description: 'A prompt-only server test prompt',
  handler: async () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: 'Prompt-only fixture message',
      },
    }],
  }),
})
