import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'public_tool',
  description: 'A tool available to everyone',
  inputSchema: {},
  handler: async () => ({
    content: [{ type: 'text', text: 'public' }],
  }),
})
