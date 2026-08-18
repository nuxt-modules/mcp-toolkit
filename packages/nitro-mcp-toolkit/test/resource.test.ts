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
          handler: (_uri, variables) => `page ${String(variables.slug)}`,
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { resourceTemplates } = await client.listResourceTemplates()
    expect(resourceTemplates).toMatchObject([{ name: 'page', uriTemplate: 'docs://{slug}' }])

    const read = await client.readResource({ uri: 'docs://getting-started' })
    expect(read.contents).toEqual([{ uri: 'docs://getting-started', text: 'page getting-started' }])
  })

  it('lists instances and completes arguments through the template callbacks', async () => {
    const pages: Record<string, string> = { install: 'Install docs', tools: 'Tools docs' }
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'page',
          uriTemplate: 'docs://{slug}',
          list: () => Object.keys(pages).map((slug) => ({ name: slug, uri: `docs://${slug}` })),
          complete: (ctx) => ({
            values: Object.keys(pages).filter((slug) => slug.startsWith(ctx.argument.value)),
          }),
          handler: (_uri, { slug }) => pages[String(slug)] ?? '',
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { resources } = await client.listResources()
    expect(resources).toEqual([
      { name: 'install', uri: 'docs://install' },
      { name: 'tools', uri: 'docs://tools' },
    ])

    const completion = await client.complete({
      ref: { type: 'ref/resource', uri: 'docs://{slug}' },
      argument: { name: 'slug', value: 'to' },
    })
    expect(completion.completion.values).toEqual(['tools'])
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

  // Unlike a tool, `resources/read` has no `isError` field: a thrown handler
  // error must surface as a JSON-RPC-level error rather than an in-band result.
  it('rejects cleanly when the handler throws, rather than an in-band result', async () => {
    const handler = createMcpHandler({
      resources: [
        defineMcpResource({
          name: 'broken',
          uri: 'docs://broken',
          handler: () => {
            throw new Error('it broke')
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    await expect(client.readResource({ uri: 'docs://broken' })).rejects.toThrow(/Internal error/)
  })
})
