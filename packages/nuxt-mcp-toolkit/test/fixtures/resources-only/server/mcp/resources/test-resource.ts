import { defineMcpResource } from '../../../../../../src/runtime/server/types'

export default defineMcpResource({
  name: 'test_resource',
  uri: 'test://resource/only',
  metadata: {
    mimeType: 'text/plain',
  },
  handler: async (uri: URL) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'text/plain',
      text: 'Resource-only fixture content',
    }],
  }),
})
