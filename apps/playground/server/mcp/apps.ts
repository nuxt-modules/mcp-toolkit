import { tools as allTools } from '#nuxt-mcp-toolkit/tools.mjs'
import { resources as allResources } from '#nuxt-mcp-toolkit/resources.mjs'

const isAppDef = (def: { _meta?: Record<string, unknown> }): boolean =>
  def._meta?.group === 'apps'

export default defineMcpHandler({
  name: 'apps',
  description:
    'Interactive MCP Apps demo — Vue-authored widgets (stay-finder carousel + stay-checkout flow) '
    + 'bundled into self-contained HTML and rendered by the host inside an iframe.',
  instructions:
    'Use `stay-finder` to surface a carousel of available stays for a destination. '
    + 'When the user picks one to reserve, route to `stay-checkout` with the stay name, '
    + 'destination, dates, traveler count and price per night.',
  tools: allTools.filter(isAppDef),
  resources: allResources.filter(isAppDef),
})
