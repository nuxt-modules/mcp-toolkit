import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpLogger } from '../../../../../../src/runtime/server/mcp/logger'

export default defineMcpTool({
  name: 'notify_all',
  description: 'Send one notification per level (debug, info, warning, error)',
  inputSchema: {},
  handler: async () => {
    const log = useMcpLogger('notify-all')
    await log.notify.debug({ msg: 'd' })
    await log.notify.info({ msg: 'i' })
    await log.notify.warning({ msg: 'w' })
    await log.notify.error({ msg: 'e' })
    return { content: [{ type: 'text', text: 'sent' }] }
  },
})
