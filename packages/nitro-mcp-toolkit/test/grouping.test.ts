import { describe, expect, it } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

describe('groups and tags', () => {
  it('advertises both in `_meta`, on all three kinds', async () => {
    await using client = await createMcpTestClient(
      createMcpHandler({
        tools: [
          defineMcpTool({
            name: 'purge',
            group: 'admin',
            tags: ['destructive', 'slow'],
            handler: () => 'purged',
          }),
        ],
        resources: [
          defineMcpResource({
            name: 'readme',
            uri: 'docs://readme',
            group: 'docs',
            tags: ['public'],
            handler: () => 'Readme',
          }),
        ],
        prompts: [
          defineMcpPrompt({
            name: 'review',
            group: 'quality',
            tags: ['slow'],
            handler: () => 'ok',
          }),
        ],
      }),
    )

    const [{ tools }, { resources }, { prompts }] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
    ])

    expect(tools[0]?._meta).toEqual({ group: 'admin', tags: ['destructive', 'slow'] })
    expect(resources[0]?._meta).toEqual({ group: 'docs', tags: ['public'] })
    expect(prompts[0]?._meta).toEqual({ group: 'quality', tags: ['slow'] })
  })

  it('says nothing when a definition declares neither', async () => {
    await using client = await createMcpTestClient(
      createMcpHandler({ tools: [defineMcpTool({ name: 'greet', handler: () => 'Hello' })] }),
    )

    const { tools } = await client.listTools()

    expect(tools[0]?._meta).toBeUndefined()
  })

  // What the generated registry produces for `tools/admin/purge.ts`.
  it('takes the group from the directory a discovered definition sits in', async () => {
    const discovered = {
      ...defineMcpTool({ name: 'purge', handler: () => 'purged' }),
      source: { file: 'tools/admin/purge.ts', group: 'admin' },
    }

    await using client = await createMcpTestClient(createMcpHandler({ tools: [discovered] }))

    const { tools } = await client.listTools()

    expect(tools[0]?._meta).toEqual({ group: 'admin' })
  })

  it('lets a definition override the group its directory implies', async () => {
    const discovered = {
      ...defineMcpTool({ name: 'purge', group: 'maintenance', handler: () => 'purged' }),
      source: { file: 'tools/admin/purge.ts', group: 'admin' },
    }

    await using client = await createMcpTestClient(createMcpHandler({ tools: [discovered] }))

    const { tools } = await client.listTools()

    expect(tools[0]?._meta).toEqual({ group: 'maintenance' })
  })
})
