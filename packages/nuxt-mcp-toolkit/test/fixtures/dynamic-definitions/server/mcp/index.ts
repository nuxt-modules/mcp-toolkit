import { defineMcpHandler } from '../../../../../src/runtime/server/types'

export default defineMcpHandler({
  version: '1.0.0',
  browserRedirect: '/',
  middleware: async (event) => {
    event.context.isAdmin = true
    event.context.userName = 'admin-user'
  },
})
