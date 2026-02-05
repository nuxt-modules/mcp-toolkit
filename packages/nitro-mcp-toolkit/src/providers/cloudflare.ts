import { toWebRequest } from 'h3'
import { createMcpTransportHandler } from './types'

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

export default createMcpTransportHandler(async (server, event) => {
  const { createMcpHandler } = await import('agents/mcp')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = createMcpHandler(server as any, {
    route: '', // allow any route
  }) // version mismatch
  const request = toWebRequest(event)
  const cf = event.context.cloudflare as CloudflareContext | undefined
  return handler(request, cf?.env ?? {}, cf?.ctx ?? fallbackCtx)
})
