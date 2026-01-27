export default defineMcpHandler({
  middleware: async (event) => {
    // CORS headers for testing with basic-host
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, mcp-protocol-version, mcp-session-id',
      'Access-Control-Expose-Headers': 'mcp-protocol-version, mcp-session-id',
    })

    // Handle preflight requests
    if (event.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    const result = await getApiKeyUser(event)
    if (result) {
      event.context.user = result.user
      event.context.userId = result.user.id
    }
  },
})
