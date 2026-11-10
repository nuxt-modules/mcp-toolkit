import { describe, expect, expectTypeOf, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import ts from 'typescript'
import { z } from 'zod'
import {
  defineMcpPlugins,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import type { CallToolResult, McpToolResult } from '../src/runtime/index.ts'
// Type-only: the module exists once a build generates it, never here.
import type generated from '#mcp/admin-mcp/handler'
import type { mcp } from 'nitro-mcp-toolkit/servers'
import type {
  ExtensionPlugin,
  McpDefinitionSummary,
  McpEvent,
  McpHandler,
  McpPrompt,
  McpResource,
  McpTool,
  McpToolReturn,
} from '../src/runtime/index.ts'

const output = z.object({ bmi: z.number() })

it('rejects invalid output callbacks through the inferred overloads', () => {
  const file = normalize(fileURLToPath(new URL('./invalid-output.ts', import.meta.url)))
  const source = [
    "import { defineMcpTool } from '../src/runtime/index.ts'",
    "import { z } from 'zod'",
    "const outputSchema = z.object({ status: z.enum(['ok', 'degraded']) })",
    "defineMcpTool({ outputSchema, handler: () => ({ status: 'unknown' }) })",
    'defineMcpTool({ outputSchema, handler: () => ({}) })',
    'defineMcpTool({ outputSchema, handler: async () => ({ status: 123 }) })',
    'defineMcpTool({ inputSchema: z.object({ id: z.string() }), outputSchema, handler: ({ id }) => ({ status: id }) })',
    "defineMcpTool({ outputSchema: z.object({ checks: z.array(outputSchema) }), handler: () => ({ checks: [{ status: 'unknown' }] }) })",
    'defineMcpTool({ outputSchema: z.object({ format: z.function({ output: z.string() }) }), handler: () => ({ format: 123 }) })',
  ].join('\n')
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile
  host.readFile = (path) => (normalize(path) === file ? source : readFile(path))
  const program = ts.createProgram([file], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  expect(
    diagnostics.map((diagnostic) => ({
      file: diagnostic.file && normalize(diagnostic.file.fileName),
      line:
        diagnostic.file && diagnostic.start !== undefined
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
          : undefined,
      code: diagnostic.code,
    })),
  ).toEqual([4, 5, 6, 7, 8, 9].map((line) => ({ file, line, code: 2769 })))
})

// Checked by `tsc` over `test/**`, not at runtime.
describe('tool typing', () => {
  it('infers handler arguments from the input schema', () => {
    defineMcpTool({
      name: 'greet',
      inputSchema: z.object({ name: z.string(), times: z.number() }),
      handler: (args, event) => {
        expectTypeOf(args).toEqualTypeOf<{ name: string; times: number }>()
        expectTypeOf(event).toEqualTypeOf<McpEvent>()
        expectTypeOf(event.context.oauth?.sub).toEqualTypeOf<string | undefined>()
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
    expectTypeOf<CallToolResult>().not.toExtend<McpToolReturn<typeof output>>()
    expectTypeOf<McpToolResult>().toExtend<McpToolReturn<typeof output>>()

    // The whole point of declaring `outputSchema`: a mismatched shape, and the
    // loose values allowed without a schema, stop being valid returns.
    expectTypeOf<{ weight: number }>().not.toExtend<McpToolReturn<typeof output>>()
    expectTypeOf<string>().not.toExtend<McpToolReturn<typeof output>>()
  })

  it('infers literal output fields without callback annotations', () => {
    const health = z.object({ status: z.enum(['ok', 'degraded']) })
    const tool = defineMcpTool({
      outputSchema: health,
      handler: () => ({ status: 'ok' }),
    })
    expectTypeOf(tool).toEqualTypeOf<McpTool>()
    defineMcpTool({
      inputSchema: z.object({ available: z.boolean() }),
      outputSchema: health,
      handler: async ({ available }) => ({ status: available ? 'ok' : 'degraded' }),
    })
    defineMcpTool({
      outputSchema: z.object({ checks: z.array(health) }),
      handler: () => ({ checks: [{ status: 'ok' }, { status: 'degraded' }] }),
    })
    defineMcpTool({
      outputSchema: z.object({ statuses: z.array(z.enum(['ok', 'degraded'])) }),
      handler: async () => ({ statuses: ['ok', 'degraded'] }),
    })
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

  it('types the /mcp instance on nitro-mcp-toolkit/servers', () => {
    expectTypeOf<typeof mcp>().toEqualTypeOf<McpHandler>()
  })
})

// Generated code imports the plugins file and is not typechecked with the app,
// so the helper is the only thing standing between a typo there and a runtime
// failure. It takes the plugins as h3-mcp installs them, and nothing narrower.
describe('the plugins convention', () => {
  it('checks the array server/mcp/plugins.ts exports', () => {
    expectTypeOf(defineMcpPlugins).parameter(0).toEqualTypeOf<readonly ExtensionPlugin[]>()
    expectTypeOf(defineMcpPlugins([{ id: 'acme/stamp', settings: () => ({}) }])).toEqualTypeOf<
      readonly ExtensionPlugin[]
    >()

    // The id is the key the extension is advertised under, so it is required.
    expectTypeOf<[{ settings: () => Record<string, never> }]>().not.toExtend<ExtensionPlugin[]>()
  })
})

describe('scope typing', () => {
  it('takes scopes on every kind of definition', () => {
    expectTypeOf(
      defineMcpTool({ name: 'remove', scopes: ['todos:write'], handler: () => 'ok' }),
    ).toEqualTypeOf<McpTool>()

    expectTypeOf(
      defineMcpResource({
        name: 'secret',
        uri: 'app://secret',
        scopes: ['files:read'],
        handler: () => 'ok',
      }),
    ).toEqualTypeOf<McpResource>()

    expectTypeOf(
      defineMcpPrompt({ name: 'review', scopes: ['code:read'], handler: () => 'ok' }),
    ).toEqualTypeOf<McpPrompt>()
  })

  it('reports them on what a handler says it serves', () => {
    expectTypeOf<McpDefinitionSummary['scopes']>().toEqualTypeOf<string[] | undefined>()
  })
})
