import { createMcpHandler, defineMcpTool } from '../../../../../src/runtime/server'
import slow from '../mcp/tools/slow'
import { contexts } from '../utils/contexts'

export default createMcpHandler({
  tools: [defineMcpTool({
    name: 'manual',
    handler: event => ({ user: event.context.user, era: event.context.mcp.era, sameContext: contexts.has(event.context) }),
  }), slow],
})
