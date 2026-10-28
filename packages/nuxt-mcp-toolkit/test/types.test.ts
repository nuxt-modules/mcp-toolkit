import { expectTypeOf, it } from 'vitest'
import { canRequestInput, createMcpHandler, defineMcpTool, defineRequestState, getElicitedContent, getInputResponses, getMissingInputs, getSupportedInputs, inputRequired, mcpElicit } from '@nuxtjs/mcp-toolkit/server'
import type { McpEvent } from '@nuxtjs/mcp-toolkit/server'
import type { McpFetchHandler } from 'nitro-mcp-toolkit/testing'
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

it('accepts MCP events in the engine continuation helpers in a Nitro 2 host', () => {
  const requests = {
    profile: mcpElicit({
      message: 'What is your name?',
      requestedSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    }),
  }
  const state = defineRequestState<{ step: number }>({
    key: 'continuation-type-test-key-32-bytes',
    bind: event => event.req.headers.get('x-user') ?? 'test-user',
  })

  defineMcpTool({
    handler: async (event) => {
      const responses = getInputResponses(event, requests)
      expectTypeOf(responses.profile?.content?.name).toEqualTypeOf<string | undefined>()
      const content = getElicitedContent(event, requests, 'profile')
      expectTypeOf(content?.name).toEqualTypeOf<string | undefined>()
      expectTypeOf(getElicitedContent<{ name: string }>(event, 'profile')?.name).toEqualTypeOf<string | undefined>()
      expectTypeOf(getSupportedInputs(event, requests)).toEqualTypeOf<Partial<typeof requests>>()
      expectTypeOf(getMissingInputs(event, requests)).toEqualTypeOf<Partial<typeof requests>>()
      const payload = await state.open(event)
      if (!content && canRequestInput(event, requests.profile)) {
        return inputRequired(event, {
          inputRequests: requests,
          requestState: await state.seal({ step: payload?.step ?? 1 }, event),
        })
      }
      return content?.name ?? 'No name'
    },
  })
})

it('accepts a composed Nuxt handler in the shared test client', () => {
  expectTypeOf(createMcpHandler()).toExtend<McpFetchHandler>()
})
