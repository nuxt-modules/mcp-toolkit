// MCP Apps live on a dedicated handler at `/mcp/apps` (see `./apps.ts`)
// so that ChatGPT-style hosts can be pointed at just the widgets without
// being polluted by the rest of the playground (auth, todos, codemode...).
// Here we exclude anything carrying `_meta.group === 'apps'` from the
// default `/mcp` surface to keep the two domains cleanly separated.
import { tools as allTools } from '#nuxt-mcp-toolkit/tools.mjs'
import { resources as allResources } from '#nuxt-mcp-toolkit/resources.mjs'

const isAppDef = (def: { _meta?: Record<string, unknown> }): boolean =>
  def._meta?.group === 'apps'

export default defineMcpHandler({
  tools: allTools.filter(d => !isAppDef(d)),
  resources: allResources.filter(d => !isAppDef(d)),
  middleware: async (event) => {
    const result = await getApiKeyUser(event)
    if (result) {
      event.context.user = result.user
      event.context.userId = result.user.id
    }

    // Role-based access: set via x-mcp-role header (defaults to 'user').
    // Use "admin" to unlock admin-only tools and prompts.
    const role = getHeader(event, 'x-mcp-role') || 'user'
    event.context.role = role

    const toolNames = await extractToolNames(event)
    if (toolNames.length > 0) {
      console.log(`[MCP] Tools called: ${toolNames.join(', ')}`)
    }
  },
})
