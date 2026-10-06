import { defineMcpTool } from '../../../../../../src/runtime/server/types'

let runs = 0

export default defineMcpTool({
  name: 'cached_tool',
  description: 'A cached tool that reports how many times its handler ran',
  inputSchema: {},
  cache: '1h',
  handler: async () => `runs: ${++runs}`,
})
