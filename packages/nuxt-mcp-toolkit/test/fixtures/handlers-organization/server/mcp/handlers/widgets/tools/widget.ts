import { defineMcpTool } from '../../../../../../../../src/runtime/server/types'

export default defineMcpTool({
  description: 'Widget tool — implicit handler `widgets` (folder exists with no index.ts).',
  handler: async () => 'widget',
})
