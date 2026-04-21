import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpLogger } from '../../../../../../src/runtime/server/mcp/logger'

export default defineMcpTool({
  name: 'wide_event',
  description: 'Populate the evlog wide event via set/event and return its context',
  inputSchema: {},
  handler: async () => {
    const log = useMcpLogger()
    log.set({ user: { id: 'user-42' } })
    log.set({ feature: 'logger-test' })
    log.event('charge_started', { amount: 1000 })

    const ctx = log.evlog.getContext() as Record<string, unknown>
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            user: ctx.user,
            feature: ctx.feature,
          }),
        },
      ],
    }
  },
})
