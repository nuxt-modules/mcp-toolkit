import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:config:resolved', ({ config }) => {
    config.tools = config.tools.filter(tool => !tool.tags?.includes('admin'))
    for (const tool of config.tools) {
      if (tool.name === 'public_tool' && tool.description) {
        tool.description = `[mutated] ${tool.description}`
      }
    }
  })

  nitroApp.hooks.hook('mcp:server:created', ({ server }) => {
    server.registerTool(
      'late_tool',
      {
        description: 'Tool registered via mcp:server:created hook',
        inputSchema: {},
      },
      async () => ({
        content: [{ type: 'text', text: 'late-result' }],
      }),
    )
  })

  nitroApp.hooks.hook('mcp:server:created', () => {
    throw new Error('intentional hook failure — should be swallowed')
  })
})
