import { checkRuntime } from './runtime.ts'

export default {
  async fetch(): Promise<Response> {
    await checkRuntime()
    return new Response('MCP runtime checks passed')
  },
}
