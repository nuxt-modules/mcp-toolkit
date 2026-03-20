import { defineMcpResource } from '../../../../../../src/runtime/server/types'

export default defineMcpResource({
  uri: 'test://resource/root',
  description: 'A root-level resource with no group',
  metadata: { mimeType: 'text/plain' },
  handler: async (uri: URL) => ({
    contents: [{ uri: uri.toString(), text: 'root resource' }],
  }),
})
