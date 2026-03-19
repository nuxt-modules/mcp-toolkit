export default defineMcpHandler({
  name: 'codemode',
  experimental_codeMode: true,
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
