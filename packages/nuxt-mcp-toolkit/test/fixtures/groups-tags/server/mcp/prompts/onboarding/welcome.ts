import { defineMcpPrompt } from '../../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  description: 'Welcome prompt for new users',
  tags: ['onboarding', 'greeting'],
  handler: async () => 'Welcome to the platform! How can I help you get started?',
})
