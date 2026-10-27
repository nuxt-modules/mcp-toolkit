import { defineEventHandler } from 'nuxt/server'
import { mcp } from 'nitro-mcp-toolkit/servers'

export default defineEventHandler((event) => {
  event.res.headers.set('cache-control', 'no-cache')
  const summarize = (kind: string) => mcp.definitions
    .filter(definition => definition.kind === kind)
    .map(({ name, description }) => ({ name, description }))

  return {
    serverInfo: { name: 'Nuxt MCP Toolkit', homepage: event.url.origin },
    endpoints: [{ type: 'streamable-http', url: new URL('/mcp', event.url).href }],
    authentication: { required: false },
    capabilities: { tools: {}, resources: {}, prompts: {} },
    tools: summarize('tool'),
    resources: mcp.definitions.filter(definition => definition.kind === 'resource')
      .map(definition => ({ name: definition.name, description: definition.description, uri: definition.uri })),
    prompts: summarize('prompt'),
  }
})
