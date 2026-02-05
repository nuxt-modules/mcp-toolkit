export default defineEventHandler(() => {
  return {
    name: 'Nitro MCP Toolkit Playground',
    description: 'A standalone Nitro server with MCP support',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
    },
  }
})
