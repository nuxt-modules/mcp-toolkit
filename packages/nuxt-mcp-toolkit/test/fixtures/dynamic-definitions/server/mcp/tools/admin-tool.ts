import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'admin_tool',
  description: 'A tool only available to admins',
  inputSchema: {},
  enabled: event => event.context.isAdmin === true,
  handler: async () => ({
    content: [{ type: 'text', text: 'admin' }],
  }),
})
