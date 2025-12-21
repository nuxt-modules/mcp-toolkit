import { defineMcpHandler } from '../../../../../src/runtime/server/types'

export default defineMcpHandler({
  version: '1.0.0',
  browserRedirect: '/',
  // Simple middleware - no next() call, it should be called automatically!
  middleware: async (event) => {
    event.context.userId = 'user-123'
    event.context.middlewareExecuted = true
    // No next() - will be called automatically
  },
})
