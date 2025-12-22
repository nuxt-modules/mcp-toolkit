export default defineMcpHandler({
  middleware: async (event) => {
    const result = await getApiKeyUser(event)
    if (result) {
      event.context.user = result.user
      event.context.userId = result.user.id
    }
  },
})
