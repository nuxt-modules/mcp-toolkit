import { describe, expectTypeOf, it } from 'vitest'
import type { Annotations, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { McpResourceAnnotations, McpToolAnnotations } from '../src/runtime/server/mcp/definitions'

/**
 * Regression guard: toolkit annotation aliases stay aligned with `@modelcontextprotocol/sdk` types.
 */
describe('sdk type compatibility', () => {
  it('McpToolAnnotations matches ToolAnnotations', () => {
    expectTypeOf<McpToolAnnotations>().toEqualTypeOf<ToolAnnotations>()
  })

  it('McpResourceAnnotations matches Annotations', () => {
    expectTypeOf<McpResourceAnnotations>().toEqualTypeOf<Annotations>()
  })
})
