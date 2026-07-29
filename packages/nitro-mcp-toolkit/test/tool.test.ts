import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { CallToolResult } from '@modelcontextprotocol/server'

function serve(...tools: ReturnType<typeof defineMcpTool>[]) {
  return createMcpHandler({ name: 'test', version: '1.0.0', tools })
}

describe('defineMcpTool', () => {
  it('exposes the tool with its metadata and calls it', async () => {
    const client = await createMcpTestClient(
      serve(
        defineMcpTool({
          name: 'greet',
          title: 'Greeter',
          description: 'Greet someone',
          inputSchema: z.object({ name: z.string() }),
          handler: ({ name }) => `Hello ${name}`,
        }),
      ),
    )

    const { tools } = await client.listTools()
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({
      name: 'greet',
      title: 'Greeter',
      description: 'Greet someone',
    })

    const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })
    expect(result.content).toEqual([{ type: 'text', text: 'Hello Ada' }])

    await client.close()
  })

  it('takes no arguments when no input schema is declared', async () => {
    const client = await createMcpTestClient(
      serve(
        defineMcpTool({
          name: 'ping',
          handler: () => 'pong',
        }),
      ),
    )

    const result = await client.callTool({ name: 'ping' })
    expect(result.content).toEqual([{ type: 'text', text: 'pong' }])

    await client.close()
  })

  it('refuses arguments that do not satisfy the input schema', async () => {
    const client = await createMcpTestClient(
      serve(
        defineMcpTool({
          name: 'greet',
          inputSchema: z.object({ name: z.string() }),
          handler: ({ name }) => name,
        }),
      ),
    )

    // Reported in-band rather than as a transport error, so the model can
    // correct itself and retry.
    const result = await client.callTool({ name: 'greet', arguments: { name: 42 } })
    expect(result.isError).toBe(true)
    expect(result.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('expected string, received number') },
    ])

    await client.close()
  })

  describe('return coercion', () => {
    it.for([
      ['string', 'hello', 'hello'],
      ['number', 42, '42'],
      ['boolean', true, 'true'],
    ] as const)('wraps a %s in text content', async ([, value, expected]) => {
      const client = await createMcpTestClient(
        serve(
          defineMcpTool({
            name: 'value',
            handler: () => value,
          }),
        ),
      )

      const result = await client.callTool({ name: 'value' })
      expect(result.content).toEqual([{ type: 'text', text: expected }])

      await client.close()
    })

    it('serializes a plain object as JSON text', async () => {
      const client = await createMcpTestClient(
        serve(
          defineMcpTool({
            name: 'value',
            handler: () => ({ a: 1 }),
          }),
        ),
      )

      const result = await client.callTool({ name: 'value' })
      expect(result.content).toEqual([{ type: 'text', text: '{\n  "a": 1\n}' }])
      expect(result.structuredContent).toBeUndefined()

      await client.close()
    })

    it('passes a full result through untouched', async () => {
      const passthrough: CallToolResult = {
        content: [{ type: 'text', text: 'raw' }],
        _meta: { marker: true },
      }
      const client = await createMcpTestClient(
        serve(
          defineMcpTool({
            name: 'value',
            handler: () => passthrough,
          }),
        ),
      )

      const result = await client.callTool({ name: 'value' })
      expect(result.content).toEqual([{ type: 'text', text: 'raw' }])
      expect(result._meta).toMatchObject({ marker: true })

      await client.close()
    })
  })

  it('sends a plain value as structuredContent when an output schema is declared', async () => {
    const client = await createMcpTestClient(
      serve(
        defineMcpTool({
          name: 'bmi',
          inputSchema: z.object({ weightKg: z.number(), heightM: z.number() }),
          outputSchema: z.object({ bmi: z.number() }),
          handler: ({ weightKg, heightM }) => ({ bmi: weightKg / (heightM * heightM) }),
        }),
      ),
    )

    const result = await client.callTool({ name: 'bmi', arguments: { weightKg: 70, heightM: 2 } })
    expect(result.structuredContent).toEqual({ bmi: 17.5 })
    expect(result.content).toEqual([{ type: 'text', text: '{\n  "bmi": 17.5\n}' }])

    await client.close()
  })

  it('turns a thrown error into an error result rather than failing the request', async () => {
    const client = await createMcpTestClient(
      serve(
        defineMcpTool({
          name: 'boom',
          handler: () => {
            throw new Error('it broke')
          },
        }),
      ),
    )

    const result = await client.callTool({ name: 'boom' })
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'it broke' }])

    await client.close()
  })
})
