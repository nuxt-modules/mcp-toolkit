export default defineMcpTool({
  description: 'Lists all documentation pages with titles, paths, and descriptions. ALWAYS call this first to discover available pages before using get-page, unless the user provides a specific path.',
  handler: async () => {
    const result = await $fetch('/api/.mcp/list-pages')
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
})
