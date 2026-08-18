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
        "audioResult",
        "createMcpHandler",
        "defineMcpPrompt",
        "defineMcpResource",
        "defineMcpTool",
        "getElicitedContent",
        "imageResult",
        "inputRequired",
        "mcpElicit",
        "mcpElicitUrl",
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
})
