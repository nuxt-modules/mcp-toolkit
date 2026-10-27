import { defineMcpTool } from 'nitro-mcp-toolkit'
import { signals } from '../../utils/signals'

export default defineMcpTool({
  name: 'slow',
  handler: event => new Promise<string>((resolve) => {
    signals.started++
    event.context.mcp.progress?.(0, 1, 'started')
    event.context.mcp.signal!.addEventListener('abort', () => {
      signals.aborted++
      resolve('cancelled')
    }, { once: true })
  }),
})
