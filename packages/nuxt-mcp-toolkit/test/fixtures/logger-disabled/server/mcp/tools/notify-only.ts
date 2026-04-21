import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpLogger } from '../../../../../../src/runtime/server/mcp/logger'

export default defineMcpTool({
  name: 'notify_only',
  description: 'Verifies notify works without observability and that set/event throw',
  inputSchema: {},
  handler: async () => {
    const log = useMcpLogger('disabled-fixture')

    await log.notify.info({ msg: 'notify still works without evlog' })

    let setError: string | null = null
    try {
      log.set({ should: 'throw' })
    }
    catch (err) {
      setError = err instanceof Error ? err.name : String(err)
    }

    let eventError: string | null = null
    try {
      log.event('should_throw')
    }
    catch (err) {
      eventError = err instanceof Error ? err.name : String(err)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ setError, eventError }),
        },
      ],
    }
  },
})
