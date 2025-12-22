import { createMcpHandler } from 'agents/mcp'
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

export default createMcpTransportHandler((server, event) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = createMcpHandler(server as any) // version mismatch
  const request = toWebRequest(event)
  const cf = event.context.cloudflare as CloudflareContext | undefined
  return handler(request, cf?.env ?? {}, cf?.ctx ?? fallbackCtx)
})
