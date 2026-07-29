import { describe, expect, it } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
  ResourceTemplate,
} from '../src/runtime/index.ts'

const handler = createMcpHandler({
  tools: [
    defineMcpTool({
      name: 'purge',
      title: 'Purge Cache',
      description: 'Drops every cached entry.',
      group: 'admin',
      tags: ['destructive'],
      handler: () => 'purged',
    }),
    {
      ...defineMcpTool({ name: 'deep', handler: () => 'deep' }),
      source: { file: 'tools/nested/deep.ts', group: 'nested' },
    },
  ],
  resources: [
    defineMcpResource({ name: 'readme', uri: 'docs://readme', handler: () => 'Readme' }),
    defineMcpResource({
      name: 'page',
      uri: new ResourceTemplate('docs://{slug}', { list: undefined }),
      handler: () => 'Page',
    }),
  ],
  prompts: [defineMcpPrompt({ name: 'review', tags: ['slow'], handler: () => 'ok' })],
})

describe('handler.definitions', () => {
  it('lists everything the endpoint serves, as plain JSON', () => {
    expect(JSON.parse(JSON.stringify(handler.definitions))).toEqual([
      {
        kind: 'tool',
        name: 'purge',
        title: 'Purge Cache',
        description: 'Drops every cached entry.',
        group: 'admin',
        tags: ['destructive'],
      },
      { kind: 'tool', name: 'deep', group: 'nested', file: 'tools/nested/deep.ts' },
      { kind: 'resource', name: 'readme', uri: 'docs://readme' },
      { kind: 'resource', name: 'page', uri: 'docs://{slug}' },
      { kind: 'prompt', name: 'review', tags: ['slow'] },
    ])
  })

  it('is the catalog a route can filter with `Array.filter`', () => {
    const destructive = handler.definitions.filter((d) => d.tags?.includes('destructive'))
    const admin = handler.definitions.filter((d) => d.group === 'admin')
    const resources = handler.definitions.filter((d) => d.kind === 'resource')

    expect(destructive.map((d) => d.name)).toEqual(['purge'])
    expect(admin.map((d) => d.name)).toEqual(['purge'])
    expect(resources.map((d) => d.name)).toEqual(['readme', 'page'])
  })

  it('cannot be altered by whoever reads it', () => {
    expect(Object.isFrozen(handler.definitions)).toBe(true)
  })
})
