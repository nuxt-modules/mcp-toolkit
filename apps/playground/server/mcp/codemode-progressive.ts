export default defineMcpHandler({
  name: 'codemode-progressive',
  experimental_codeMode: {
    progressive: true,
  },
  middleware: async (event) => {
    const result = await getApiKeyUser(event)
    if (result) {
      event.context.user = result.user
      event.context.userId = result.user.id
    }

    const role = getHeader(event, 'x-mcp-role') || 'user'
    event.context.role = role
  },
})
