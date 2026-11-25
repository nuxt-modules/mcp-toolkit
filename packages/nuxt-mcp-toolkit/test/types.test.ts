import { expectTypeOf, it } from 'vitest'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import type { McpEvent } from '@nuxtjs/mcp-toolkit/server'
import type { H3Event } from 'h3/generic'

it('gives tool handlers a web-standard request inside a Nitro 2 host', () => {
  expectTypeOf<McpEvent['req']>().toEqualTypeOf<H3Event['req']>()
  defineMcpTool({
    handler: (event) => {
      expectTypeOf(event.req).toExtend<Request>()
      return event.req.headers.get('x-demo')
    },
  })
})
