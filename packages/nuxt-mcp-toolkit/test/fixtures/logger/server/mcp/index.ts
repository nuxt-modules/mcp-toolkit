import { getHeader } from 'h3'
import { defineMcpHandler } from '../../../../../src/runtime/server/types'

export default defineMcpHandler({
  middleware: async (event) => {
    if (getHeader(event, 'x-test-auth') === '1') {
      event.context.user = { id: 'user-99', email: 'op@example.com', name: 'Op' }
      event.context.session = { id: 'sess-77' }
    }
  },
})
