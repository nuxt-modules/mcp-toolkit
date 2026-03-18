import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  name: 'disabled_prompt',
  description: 'A prompt that is always disabled',
  enabled: () => false,
  handler: async () => ({
    messages: [{ role: 'user', content: { type: 'text', text: 'should not be visible' } }],
  }),
})
