import { defineMcpPrompt } from '../../../../../../src/runtime/server/types'

export default defineMcpPrompt({
  description: 'Orphan prompt — exposed via the default handler only.',
  handler: async () => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: 'hello orphan' },
    }],
  }),
})
