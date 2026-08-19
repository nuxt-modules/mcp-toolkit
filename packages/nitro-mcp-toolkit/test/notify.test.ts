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
    client.setNotificationHandler('notifications/resources/updated', (notification) => {
      seen.push(`updated:${String(notification.params?.uri ?? '')}`)
    })
    const subscription = await client.listen({
      toolsListChanged: true,
      promptsListChanged: true,
      resourcesListChanged: true,
      resourceSubscriptions: ['docs://readme'],
    })

    handler.notify.toolsChanged()
    handler.notify.promptsChanged()
    handler.notify.resourcesChanged()
    handler.notify.resourceUpdated('docs://readme')
    await vi.waitFor(() =>
      expect(seen.sort()).toEqual(['prompts', 'resources', 'tools', 'updated:docs://readme']),
    )

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
