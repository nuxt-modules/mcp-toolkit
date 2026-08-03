import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpResource } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

describe('defineMcpResource', () => {
  it('reads a static resource, coercing a returned string into contents', async () => {
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'readme',
          description: 'The readme',
          mimeType: 'text/markdown',
          uri: 'docs://readme',
          handler: (uri) => `contents of ${uri.href}`,
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { resources } = await client.listResources()
    expect(resources).toMatchObject([
      {
        name: 'readme',
        uri: 'docs://readme',
        description: 'The readme',
        mimeType: 'text/markdown',
      },
    ])

    const read = await client.readResource({ uri: 'docs://readme' })
    expect(read.contents).toEqual([{ uri: 'docs://readme', text: 'contents of docs://readme' }])
  })

  it('resolves template variables for a templated resource', async () => {
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'page',
          uriTemplate: 'docs://{slug}',
          handler: (_uri, variables) => `page ${variables.slug}`,
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { resourceTemplates } = await client.listResourceTemplates()
    expect(resourceTemplates).toMatchObject([{ name: 'page', uriTemplate: 'docs://{slug}' }])

    const read = await client.readResource({ uri: 'docs://getting-started' })
    expect(read.contents).toEqual([{ uri: 'docs://getting-started', text: 'page getting-started' }])
  })

  it('lists and completes what a template can resolve', async () => {
    const slugs = ['getting-started', 'guide', 'reference']
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'page',
          uriTemplate: 'docs://{slug}',
          list: () => slugs.map((slug) => ({ name: slug, uri: `docs://${slug}` })),
          complete: ({ argument }) => slugs.filter((slug) => slug.startsWith(argument.value)),
          handler: (_uri, variables) => `page ${variables.slug}`,
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    // A template that can list its instances shows up under `resources/list`
    // too, so a client that never reads templates still finds the pages.
    const { resources } = await client.listResources()
    expect(resources).toMatchObject([
      { name: 'getting-started', uri: 'docs://getting-started' },
      { name: 'guide', uri: 'docs://guide' },
      { name: 'reference', uri: 'docs://reference' },
    ])

    const completion = await client.complete({
      ref: { type: 'ref/resource', uri: 'docs://{slug}' },
      argument: { name: 'slug', value: 'g' },
    })
    expect(completion.completion.values).toEqual(['getting-started', 'guide'])
  })

  it('passes a full result through untouched', async () => {
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'binary',
          uri: 'blob://logo',
          handler: () => ({
            contents: [{ uri: 'blob://logo', blob: 'AAA=', mimeType: 'image/png' }],
          }),
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const read = await client.readResource({ uri: 'blob://logo' })
    expect(read.contents).toEqual([{ uri: 'blob://logo', blob: 'AAA=', mimeType: 'image/png' }])
  })
})
