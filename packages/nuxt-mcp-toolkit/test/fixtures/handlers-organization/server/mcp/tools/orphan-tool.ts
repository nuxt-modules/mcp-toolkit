import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  description: 'A plain orphan tool — no handler attribution.',
  handler: async () => 'orphan',
})
