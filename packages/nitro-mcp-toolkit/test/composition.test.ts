import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import type { McpHandlerOptions, McpNotifier } from '../src/runtime/index.ts'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'

describe('composing definitions', () => {
  const tools = Object.freeze([defineMcpTool({ name: 'greet', handler: () => 'hello' })])
  const resources = Object.freeze([
    defineMcpResource({ name: 'readme', uri: 'docs://readme', handler: () => 'readme' }),
  ])
  const prompts = Object.freeze([defineMcpPrompt({ name: 'review', handler: () => 'review this' })])

  it('accepts readonly collections without copying them in application code', async () => {
    expectTypeOf({ tools, resources, prompts }).toExtend<McpHandlerOptions>()
    const handler = createMcpHandler({ tools, resources, prompts })
    await using client = await createMcpTestClient(handler)
    expect(textOf(await client.callTool({ name: 'greet' }))).toBe('hello')
    expect(textOf(await client.readResource({ uri: 'docs://readme' }))).toBe('readme')
    expect(textOf(await client.getPrompt({ name: 'review' }))).toBe('review this')
  })

  for (const era of ['modern', 'legacy'] as const) {
    it(`keeps identity and notifications local when two endpoints share a tool (${era})`, async () => {
      let enter!: () => void
      let release!: () => void
      const entered = new Promise<void>((resolve) => {
        enter = resolve
      })
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      const seen = new Map<string, McpNotifier>()
      let arrivals = 0
      const shared = Object.freeze(
        defineMcpTool({
          name: 'account',
          scopes: ['account:read'],
          handler: async (event) => {
            if (++arrivals === 2) enter()
            await released
            const subject = event.context.oauth?.sub ?? ''
            seen.set(subject, event.context.mcp.notify)
            return subject
          },
        }),
      )
      const auth: McpHandlerOptions['auth'] = {
        schemes: ['bearer'],
        validate: (credential, event) => {
          event.context.oauth = { sub: credential.token, scope: 'account:read' }
          return true
        },
      }
      const first = createMcpHandler({ name: 'first', auth, tools: [shared] })
      const second = createMcpHandler({ name: 'second', auth, tools: [shared] })
      await using alice = await createMcpTestClient(first, {
        era,
        headers: { authorization: 'Bearer alice' },
      })
      await using bob = await createMcpTestClient(second, {
        era,
        headers: { authorization: 'Bearer bob' },
      })
      const results = Promise.all([
        alice.callTool({ name: 'account' }),
        bob.callTool({ name: 'account' }),
      ])
      try {
        await entered
      } finally {
        release()
      }
      expect((await results).map(textOf)).toEqual(['alice', 'bob'])
      expect(seen.get('alice')).toBe(first.notify)
      expect(seen.get('bob')).toBe(second.notify)
      expect(first.notify).not.toBe(second.notify)
      expect(shared.name).toBe('account')
      expect(first.definitions).toEqual(second.definitions)
    })
  }
})
