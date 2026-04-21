import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpLogger } from '../../../../../../src/runtime/server/mcp/logger'

export default defineMcpTool({
  name: 'notify_named',
  description: 'Send a single info notification using the prefix override',
  inputSchema: {},
  handler: async () => {
    const log = useMcpLogger('default-prefix')
    await log.notify.info({ msg: 'first' })
    await log.notify.info({ msg: 'override' }, 'override-prefix')
    return { content: [{ type: 'text', text: 'sent' }] }
  },
})
