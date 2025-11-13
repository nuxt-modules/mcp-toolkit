import { defineMcpResource } from '../../../../../../src/runtime/server/types'

export default defineMcpResource({
  name: 'test_resource',
  title: 'Test Resource',
  uri: 'test://resource/test',
  metadata: {
    description: 'A simple test resource for MCP testing',
    mimeType: 'text/plain',
  },
  handler: async (uri: URL) => {
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'text/plain',
        text: 'This is test resource content',
      }],
    }
  },
})
