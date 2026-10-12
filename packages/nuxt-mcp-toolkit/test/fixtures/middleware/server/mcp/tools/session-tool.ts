import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpSession } from '../../../../../../src/runtime/server/mcp/session'

export default defineMcpTool({
  name: 'session_tool',
  description: 'Writes to the session store',
  inputSchema: {},
  handler: async () => {
    await useMcpSession().set('written', true)
    return 'written'
  },
})
