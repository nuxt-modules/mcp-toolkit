import { defineMcpPrompt } from '../../../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  description: 'Admin help prompt — auto-attached via folder convention.',
  handler: async () => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: 'admin help' },
    }],
  }),
})
