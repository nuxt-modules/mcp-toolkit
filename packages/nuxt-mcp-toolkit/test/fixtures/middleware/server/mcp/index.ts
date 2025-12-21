import { defineMcpHandler } from '../../../../../src/runtime/server/types'

export default defineMcpHandler({
  version: '1.0.0',
  browserRedirect: '/',
  middleware: async (event, next) => {
    // Set context for tools to access
    event.context.userId = 'user-123'
    event.context.middlewareExecuted = true
    event.context.startTime = Date.now()

    const response = await next()

    event.context.endTime = Date.now()
    return response
  },
})
