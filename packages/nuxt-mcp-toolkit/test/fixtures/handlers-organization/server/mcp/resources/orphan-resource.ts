import { defineMcpResource } from '../../../../../../src/runtime/server/types'

export default defineMcpResource({
  uri: 'test://orphan',
  description: 'Orphan resource — exposed via the default handler only.',
  handler: async (uri: URL) => ({
    contents: [{ uri: uri.toString(), text: 'orphan-resource' }],
  }),
})
