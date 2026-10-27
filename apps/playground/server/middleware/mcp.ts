export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname !== '/mcp') return
  const result = await getApiKeyUser(event)
  if (!result) throw createError({ statusCode: 403, message: 'A valid API key is required.' })
  event.context.user = result.user
  event.context.userId = result.user.id
})
