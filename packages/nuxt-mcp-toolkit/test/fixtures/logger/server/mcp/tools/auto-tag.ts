import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpLogger } from '../../../../../../src/runtime/server/mcp/logger'

export default defineMcpTool({
  name: 'auto_tag',
  description: 'Returns user/session auto-tagged onto the wide event from event.context',
  inputSchema: {},
  handler: async () => {
    const log = useMcpLogger()
    const ctx = log.evlog.getContext() as Record<string, unknown>
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            user: ctx.user,
            session: ctx.session,
            mcpTool: (ctx.mcp as { tool?: string } | undefined)?.tool ?? null,
          }),
        },
      ],
    }
  },
})
