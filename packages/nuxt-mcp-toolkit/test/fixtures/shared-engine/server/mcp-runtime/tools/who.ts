import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  scopes: ['read'],
  handler: event => ({
    subject: event.context.oauth?.sub,
    scope: event.context.oauth?.scope,
    user: event.context.user,
    era: event.context.mcp.era,
  }),
})
