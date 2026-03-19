import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  name: 'string_prompt',
  title: 'String Prompt',
  description: 'A prompt that returns a simple string',
  handler: async () => 'You are a helpful assistant that helps with code review.',
})
