import type {
  AuthCredentials,
  AuthValidator,
  CompleteCallback,
  ResourceTemplateListCallback,
} from 'h3-mcp'
import { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import { createMcpHandler, defineMcpPrompt, defineMcpResource } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

it('sets up each extension plugin once per endpoint', () => {
  const setup = vi.fn<() => void>()
  createMcpHandler({}, { extensionPlugins: [{ id: 'test/setup', setup }] })
  expect(setup).toHaveBeenCalledTimes(1)
})

it('authenticates an unknown tool filter against the original request and context', async () => {
  const request = new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      authorization: 'Bearer good',
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'x-mcp-tools': 'missing',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
  })
  const event = new H3Event(request)
  event.context.oauth = { sub: 'middleware-user' }
  const validate = vi.fn<AuthValidator>(async (_credential: AuthCredentials, received: H3Event) => {
    expect(received.context.oauth?.sub).toBe('middleware-user')
    expect(await received.req.clone().json()).toEqual({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/list',
    })
    return received === event
  })
  const handler = createMcpHandler({ auth: { schemes: ['bearer'], validate } })
  const response = await handler(event)
  expect(response.status).toBe(400)
  expect(validate).toHaveBeenCalledOnce()
})

describe.each(['legacy', 'modern'] as const)('%s scoped callbacks', (era) => {
  it('refuses dynamic resource listing and completion before running app code', async () => {
    const list = vi.fn<ResourceTemplateListCallback>(() => [
      { name: 'secret', uri: 'app://docs/secret' },
    ])
    const complete = vi.fn<CompleteCallback>(() => ({ values: ['secret'] }))
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'docs',
          uriTemplate: 'app://docs/{slug}',
          scopes: ['docs:read'],
          list,
          complete,
          handler: () => 'secret',
        }),
      ],
    })
    await using client = await createMcpTestClient(handler, { era })
    await expect(client.listResources()).rejects.toThrow(/requires docs:read/)
    await expect(
      client.complete({
        ref: { type: 'ref/resource', uri: 'app://docs/{slug}' },
        argument: { name: 'slug', value: '' },
      }),
    ).rejects.toThrow(/requires docs:read/)
    expect(list).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })

  it('refuses prompt completion before running app code', async () => {
    const complete = vi.fn<CompleteCallback>(() => ({ values: ['secret'] }))
    const handler = createMcpHandler({
      prompts: [
        defineMcpPrompt({
          name: 'review',
          scopes: ['docs:read'],
          arguments: [{ name: 'slug', complete }],
          handler: () => 'secret',
        }),
      ],
    })
    await using client = await createMcpTestClient(handler, { era })
    await expect(
      client.complete({
        ref: { type: 'ref/prompt', name: 'review' },
        argument: { name: 'slug', value: '' },
      }),
    ).rejects.toThrow(/requires docs:read/)
    expect(complete).not.toHaveBeenCalled()
  })
})

describe.each(['legacy', 'modern'] as const)('%s authorized callbacks', (era) => {
  it('runs enumeration and completion with verified claims', async () => {
    const handler = createMcpHandler({
      auth: {
        schemes: ['bearer'],
        validate: (_credential, event) => {
          event.context.oauth = { sub: 'reader', scope: 'docs:read' }
          return true
        },
      },
      resources: [
        defineMcpResource({
          name: 'docs',
          uriTemplate: 'app://docs/{slug}',
          scopes: ['docs:read'],
          list: (event) => [{ name: String(event.context.oauth?.sub), uri: 'app://docs/intro' }],
          complete: (_context, event) => ({ values: [String(event.context.oauth?.sub)] }),
          handler: () => 'intro',
        }),
      ],
      prompts: [
        defineMcpPrompt({
          name: 'review',
          scopes: ['docs:read'],
          arguments: [
            {
              name: 'slug',
              complete: (_context, event) => ({ values: [String(event.context.oauth?.sub)] }),
            },
          ],
          handler: () => 'review',
        }),
      ],
    })
    await using client = await createMcpTestClient(handler, {
      era,
      headers: { authorization: 'Bearer valid' },
    })
    expect((await client.listResources()).resources).toMatchObject([{ name: 'reader' }])
    expect(
      (
        await client.complete({
          ref: { type: 'ref/resource', uri: 'app://docs/{slug}' },
          argument: { name: 'slug', value: '' },
        })
      ).completion.values,
    ).toEqual(['reader'])
    expect(
      (
        await client.complete({
          ref: { type: 'ref/prompt', name: 'review' },
          argument: { name: 'slug', value: '' },
        })
      ).completion.values,
    ).toEqual(['reader'])
  })
})
