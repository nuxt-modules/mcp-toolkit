import { getRequestURL } from 'h3'
import { defineMcpHandler } from '../../../../../src/runtime/server/types'
import { invalidateMcpSession } from '../../../../../src/runtime/server/mcp/session'

export default defineMcpHandler({
  middleware: async (event) => {
    if (getRequestURL(event).searchParams.get('invalidateSession') === '1') {
      invalidateMcpSession()
    }
  },
})
