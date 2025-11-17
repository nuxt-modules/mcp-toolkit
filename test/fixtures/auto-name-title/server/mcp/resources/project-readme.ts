import { defineMcpResource } from '../../../../../../src/runtime/server/types'

// name and title are auto-generated from filename
export default defineMcpResource({
  uri: 'test://readme',
  handler: async (uri: URL) => {
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'text/plain',
        text: 'README content',
      }],
    }
  },
})
