import { defineEventHandler } from 'nuxt/server'
import { createMcpHandler as createHandler } from 'nitro-mcp-toolkit'
import type { McpHandlerOptions, PluginOptions } from 'nitro-mcp-toolkit'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestEvent } from 'nuxt/server'

interface NitroRequestEvent extends RequestEvent {
  node?: { req: IncomingMessage, res: ServerResponse }
  waitUntil?: (promise: Promise<unknown>) => void
}

export function createMcpHandler(options: McpHandlerOptions = {}, plugins?: PluginOptions) {
  const handler = createHandler(options, plugins)
  return Object.assign(
    defineEventHandler(async (event: NitroRequestEvent) => {
      const { node } = event
      let request = event.req
      if (node) {
        const disconnected = new AbortController()
        node.res.once('close', () => disconnected.abort())
        const init = {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: AbortSignal.any([request.signal, disconnected.signal]),
          duplex: 'half',
        }
        request = Object.assign(new Request(request.url, init), {
          waitUntil: event.waitUntil?.bind(event),
          runtime: { node, cloudflare: event.context.cloudflare },
        })
      }
      const { params } = event.context
      const context = Object.assign(event.context, {
        params: params && Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      })
      const response = await handler.fetch(request, context)
      if (!node || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) return response

      const reader = response.body.getReader()
      const abort = () => {
        void reader.cancel()
      }
      if (request.signal.aborted) abort()
      else request.signal.addEventListener('abort', abort, { once: true })
      return new Response(new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read()
          if (done) {
            request.signal.removeEventListener('abort', abort)
            controller.close()
          }
          else controller.enqueue(value)
        },
        cancel(reason) {
          request.signal.removeEventListener('abort', abort)
          return reader.cancel(reason)
        },
      }), response)
    }),
    { fetch: handler.fetch, definitions: handler.definitions, notify: handler.notify },
  )
}

export type McpHandler = ReturnType<typeof createMcpHandler>
