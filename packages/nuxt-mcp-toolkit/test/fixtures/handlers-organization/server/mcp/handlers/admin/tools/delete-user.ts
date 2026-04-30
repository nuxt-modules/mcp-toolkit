import { defineMcpTool } from '../../../../../../../../src/runtime/server/types'

export default defineMcpTool({
  description: 'Admin-only delete user tool — auto-attached to handler `admin` via folder convention.',
  handler: async () => 'deleted',
})
