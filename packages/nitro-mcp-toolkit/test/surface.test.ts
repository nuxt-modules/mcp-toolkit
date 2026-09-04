import { describe, expect, it } from 'vitest'
import * as moduleEntry from '../src/module/index.ts'
import * as runtime from '../src/runtime/index.ts'
import * as testing from '../src/testing/index.ts'

// The published surface is the one thing that cannot change without warning, so
// a diff here is the reminder to ship a changeset — or to put an export back.
describe('public exports', () => {
  it('exposes the runtime entry', () => {
    expect(Object.keys(runtime).sort()).toMatchInlineSnapshot(`
      [
        "MODERN_PROTOCOL_VERSION",
        "McpJsonRpcError",
        "audioResult",
        "authorizationServerMetadataUrl",
        "canRequestInput",
        "createMcpHandler",
        "createMcpOAuth",
        "defineMcpPlugins",
        "defineMcpPrompt",
        "defineMcpResource",
        "defineMcpTool",
        "defineRequestState",
        "getElicitedContent",
        "getInputResponses",
        "getMissingInputs",
        "getSupportedInputs",
        "imageResult",
        "inputRequired",
        "mcpElicit",
        "mcpElicitUrl",
        "protectedResourceMetadataUrl",
        "toolResult",
      ]
    `)
  })

  it('exposes the module entry', () => {
    expect(Object.keys(moduleEntry).sort()).toMatchInlineSnapshot(`
      [
        "default",
      ]
    `)
  })

  it('exposes the testing entry', () => {
    expect(Object.keys(testing).sort()).toMatchInlineSnapshot(`
      [
        "createMcpTestClient",
        "textOf",
      ]
    `)
  })

  it('does not load nitro-mcp-toolkit/servers outside mcp()', async () => {
    await expect(import('../src/runtime/servers.ts')).rejects.toThrow(/provided by `mcp\(\)`/)
  })

  it('exposes oauth connectors on their own entries', async () => {
    expect(Object.keys(await import('../src/runtime/oauth/clerk.ts')).sort()).toEqual(['clerk'])
    expect(Object.keys(await import('../src/runtime/oauth/okta.ts')).sort()).toEqual(['okta'])
    expect(Object.keys(await import('../src/runtime/oauth/workos.ts')).sort()).toEqual(['workos'])
  })
})
