export default defineMcpHandler({
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
  },
})
