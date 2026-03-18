import { defineMcpHandler } from '../../../../../src/runtime/server/types'

export default defineMcpHandler({
  version: '1.0.0',
  browserRedirect: '/',
  middleware: async (event, next) => {
    event.context.userId = 'user-123'
    event.context.middlewareExecuted = true

    const response = await next()
    if (!response || typeof response.status !== 'number') {
      throw new Error('next() did not return a valid Response')
    }
    return response
  },
})
