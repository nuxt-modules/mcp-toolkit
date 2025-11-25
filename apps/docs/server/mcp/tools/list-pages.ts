export default defineMcpTool({
  description: 'Lists all available documentation pages with their titles, paths, and descriptions',
  handler: async (params) => {
    const result = await $fetch('/api/.mcp/list-pages', { query: params })
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
})
