import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  name: 'dynamic_prompt',
  description: 'A prompt that is only available to admins',
  enabled: event => !!event.context.isAdmin,
  handler: async () => ({
    messages: [{ role: 'user', content: { type: 'text', text: 'admin prompt' } }],
  }),
})
