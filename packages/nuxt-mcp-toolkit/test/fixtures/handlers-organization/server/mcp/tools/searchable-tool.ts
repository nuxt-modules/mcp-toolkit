import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  description: 'Orphan tool tagged for the `filtered` handler to pick up via filter object.',
  tags: ['searchable'],
  handler: async () => 'searchable',
})
