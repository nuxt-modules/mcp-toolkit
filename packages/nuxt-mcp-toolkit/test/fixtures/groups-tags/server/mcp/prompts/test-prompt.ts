import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  description: 'A root-level prompt with no group',
  handler: async () => 'You are a helpful assistant.',
})
