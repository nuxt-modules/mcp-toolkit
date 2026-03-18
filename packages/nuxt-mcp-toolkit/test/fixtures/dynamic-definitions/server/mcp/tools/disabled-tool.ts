import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'disabled_tool',
  description: 'A tool that is always disabled',
  inputSchema: {},
  enabled: () => false,
  handler: async () => ({
    content: [{ type: 'text', text: 'should not be visible' }],
  }),
})
