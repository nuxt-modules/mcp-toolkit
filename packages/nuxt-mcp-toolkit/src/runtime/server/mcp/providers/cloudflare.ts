import { createMcpTransportHandler } from './types'
import { toWebRequest } from '../compat'

interface CloudflareContext {
  env: Record<string, unknown>
  ctx: ExecutionContext
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

const fallbackCtx: ExecutionContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
}

export default createMcpTransportHandler(async (createServer, event) => {
  const server = createServer()
  event.context._mcpServer = server
  const { createMcpHandler } = await import('agents/mcp')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = createMcpHandler(server as any, {
    route: '', // allow any route
  }) // version mismatch
  const request = await toWebRequest(event)
  const cf = event.context.cloudflare as CloudflareContext | undefined
  return handler(request, cf?.env ?? {}, cf?.ctx ?? fallbackCtx)
})
