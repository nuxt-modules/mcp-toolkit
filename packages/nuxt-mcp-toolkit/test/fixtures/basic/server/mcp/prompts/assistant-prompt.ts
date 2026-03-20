import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  name: 'assistant_prompt',
  title: 'Assistant Prompt',
  description: 'A prompt that returns a string with assistant role',
  role: 'assistant',
  handler: async () => 'I am a code review assistant ready to help.',
})
