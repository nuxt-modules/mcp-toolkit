import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  uri: 'nitro://server/info',
  description: 'Information about the Nitro server',
  handler: async () => {
    return {
      contents: [{
        uri: 'nitro://server/info',
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'Nitro MCP Playground',
          version: '1.0.0',
          runtime: 'nitro',
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
        }, null, 2),
      }],
    }
  },
})
