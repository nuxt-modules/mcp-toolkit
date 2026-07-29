import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpResource, ResourceTemplate } from '../src/runtime/index.ts'
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
          uri: new ResourceTemplate('docs://{slug}', { list: undefined }),
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
