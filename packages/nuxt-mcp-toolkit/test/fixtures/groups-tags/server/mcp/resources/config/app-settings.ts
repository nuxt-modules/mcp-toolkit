import { defineMcpResource } from '../../../../../../../src/runtime/server/types'

export default defineMcpResource({
  uri: 'test://resource/app-settings',
  description: 'Application settings resource in config group',
  tags: ['readonly', 'settings'],
  metadata: { mimeType: 'application/json' },
  handler: async (uri: URL) => ({
    contents: [{ uri: uri.toString(), text: JSON.stringify({ theme: 'dark' }) }],
  }),
})
