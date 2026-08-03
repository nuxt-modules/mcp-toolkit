import { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { buildContext } from '../src/runtime/context.ts'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'

// Reaching a definition through anything but the toolkit's handler has to say
// so, rather than fail on a confusing property access.
describe('a definition reached outside the toolkit handler', () => {
  it('explains that the event carries no MCP request', () => {
    expect(() => buildContext(new H3Event(new Request('http://localhost/mcp')))).toThrow(
      /No MCP request on this event/,
    )
  })
})

describe('a definition nobody ever named', () => {
  // A name is optional because discovery derives one from the filename; a
  // definition that got neither has to be refused before it serves anything.
  it('is refused when the endpoint is built', () => {
    expect(() => createMcpHandler({ tools: [defineMcpTool({ handler: () => 'pong' })] })).toThrow(
      /A tool was defined without a name/,
    )
  })
})
