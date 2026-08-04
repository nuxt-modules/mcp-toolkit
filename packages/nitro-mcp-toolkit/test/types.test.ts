import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { defineMcpTool } from '../src/runtime/index.ts'
import type { CallToolResult } from '@modelcontextprotocol/server'
// Type-only: the module exists once a build generates it, never here.
import type generated from '#mcp/admin-mcp/handler'
import type { McpEvent, McpHandler, McpToolReturn } from '../src/runtime/index.ts'

const output = z.object({ bmi: z.number() })

// Checked by `tsc` over `test/**`, not at runtime.
describe('tool typing', () => {
  it('infers handler arguments from the input schema', () => {
    defineMcpTool({
      name: 'greet',
      inputSchema: z.object({ name: z.string(), times: z.number() }),
      handler: (args, event) => {
        expectTypeOf(args).toEqualTypeOf<{ name: string; times: number }>()
        expectTypeOf(event).toEqualTypeOf<McpEvent>()
        return 'ok'
      },
    })
  })

  it('passes only the event when no input schema is declared', () => {
    defineMcpTool({
      name: 'ping',
      handler: (event) => {
        expectTypeOf(event).toEqualTypeOf<McpEvent>()
        return 'pong'
      },
    })
  })

  it('narrows the return type to the output schema', () => {
    expectTypeOf<{ bmi: number }>().toExtend<McpToolReturn<typeof output>>()
    expectTypeOf<CallToolResult>().toExtend<McpToolReturn<typeof output>>()

    // The whole point of declaring `outputSchema`: a mismatched shape, and the
    // loose values allowed without a schema, stop being valid returns.
    expectTypeOf<{ weight: number }>().not.toExtend<McpToolReturn<typeof output>>()
    expectTypeOf<string>().not.toExtend<McpToolReturn<typeof output>>()
  })

  it('accepts any plain value when no output schema is declared', () => {
    expectTypeOf<string>().toExtend<McpToolReturn<undefined>>()
    expectTypeOf<number>().toExtend<McpToolReturn<undefined>>()
    expectTypeOf<{ anything: true }>().toExtend<McpToolReturn<undefined>>()
  })
})

// The ambient declaration in `src/runtime/virtual.d.ts` is what spares an app
// from mapping the id itself, whatever route it mounted.
describe('the generated handler modules', () => {
  it('are typed for whichever route mounted them', () => {
    expectTypeOf<typeof generated>().toEqualTypeOf<McpHandler>()
  })
})
