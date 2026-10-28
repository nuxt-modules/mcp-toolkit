import { defineMcpPrompt } from '../../../../../../src/runtime/server/index'

export default defineMcpPrompt({
  name: 'assistant_prompt',
  title: 'Assistant Prompt',
  description: 'A prompt that returns a string with assistant role',
  handler: async () => ({ messages: [{ role: 'assistant', content: { type: 'text', text: 'I am a code review assistant ready to help.' } }] }),
})
