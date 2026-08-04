import { describe, expect, it, vi } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

function serve() {
  return createMcpHandler({
    tools: [defineMcpTool({ name: 'ping', handler: () => 'pong' })],
    resources: [defineMcpResource({ name: 'readme', uri: 'docs://readme', handler: () => 'hi' })],
    prompts: [defineMcpPrompt({ name: 'standup', handler: () => 'Summarize yesterday.' })],
  })
}

describe('handler.notify', () => {
  it('pushes list-changed events to a client listening for them', async () => {
    const handler = serve()
    await using client = await createMcpTestClient(handler)

    const seen: string[] = []
    client.setNotificationHandler('notifications/tools/list_changed', () => {
      seen.push('tools')
    })
    client.setNotificationHandler('notifications/prompts/list_changed', () => {
      seen.push('prompts')
    })
    client.setNotificationHandler('notifications/resources/list_changed', () => {
      seen.push('resources')
    })
    const subscription = await client.listen({
      toolsListChanged: true,
      promptsListChanged: true,
      resourcesListChanged: true,
    })

    handler.notify.toolsChanged()
    handler.notify.promptsChanged()
    handler.notify.resourcesChanged()
    await vi.waitFor(() => expect(seen.sort()).toEqual(['prompts', 'resources', 'tools']))

    await subscription.close()
  })
})

describe('event.context.mcp.notify', () => {
  it('is the same object as handler.notify, reachable without importing the handler', async () => {
    const seen: string[] = []
    const purge = defineMcpTool({
      name: 'purge',
      handler: (event) => {
        event.context.mcp.notify.resourcesChanged()
        return 'ok'
      },
    })
    const handler = createMcpHandler({
      tools: [purge],
      resources: [defineMcpResource({ name: 'readme', uri: 'docs://readme', handler: () => 'hi' })],
    })
    await using client = await createMcpTestClient(handler)

    client.setNotificationHandler('notifications/resources/list_changed', () => {
      seen.push('resources')
    })
    const subscription = await client.listen({ resourcesListChanged: true })

    await client.callTool({ name: 'purge' })
    await vi.waitFor(() => expect(seen).toEqual(['resources']))

    await subscription.close()
  })
})

describe('handler.bus', () => {
  // `resourceUpdated` has no wire-level test: the SDK's `McpServer` never
  // registers `resources/subscribe`, so no client can honor a per-uri filter
  // today — the facade-to-event mapping below is the boundary this package
  // does own.
  it('is what notify publishes to, one event per call', () => {
    const handler = serve()

    const events: unknown[] = []
    const unsubscribe = handler.bus.subscribe((event) => events.push(event))

    handler.notify.resourcesChanged()
    handler.notify.resourceUpdated('docs://readme')
    unsubscribe()
    handler.notify.promptsChanged() // published after unsubscribing, so it must not show up

    expect(events).toEqual([
      { kind: 'resources_list_changed' },
      { kind: 'resource_updated', uri: 'docs://readme' },
    ])
  })
})
