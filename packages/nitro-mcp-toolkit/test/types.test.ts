import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { defineMcpTool } from '../src/runtime/index.ts'
import type { CallToolResult } from '@modelcontextprotocol/server'
import type { McpContext, McpToolReturn } from '../src/runtime/index.ts'

const output = z.object({ bmi: z.number() })

// Checked by `tsc` over `test/**`, not at runtime.
describe('tool typing', () => {
  it('infers handler arguments from the input schema', () => {
    defineMcpTool({
      name: 'greet',
      inputSchema: z.object({ name: z.string(), times: z.number() }),
      handler: (args, ctx) => {
        expectTypeOf(args).toEqualTypeOf<{ name: string; times: number }>()
        expectTypeOf(ctx).toEqualTypeOf<McpContext>()
        return 'ok'
      },
    })
  })

  it('passes only the context when no input schema is declared', () => {
    defineMcpTool({
      name: 'ping',
      handler: (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<McpContext>()
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
