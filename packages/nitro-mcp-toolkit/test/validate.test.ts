import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'

// A clash would otherwise first show up as an HTTP 500 on the first call,
// with the cause absent from the message the client receives.
describe('createMcpHandler validation', () => {
  it('rejects two tools sharing a name', () => {
    expect(() =>
      createMcpHandler({
        tools: [
          defineMcpTool({ name: 'greet', handler: () => 'first' }),
          defineMcpTool({ name: 'greet', handler: () => 'second' }),
        ],
      }),
    ).toThrow(/Tools must have unique names, but "greet" is used twice/)
  })

  it('allows the same name across different kinds', () => {
    expect(() =>
      createMcpHandler({
        tools: [defineMcpTool({ name: 'review', handler: () => 'ok' })],
        prompts: [defineMcpPrompt({ name: 'review', handler: () => 'ok' })],
      }),
    ).not.toThrow()
  })

  it('rejects two resources answering the same URI', () => {
    expect(() =>
      createMcpHandler({
        resources: [
          defineMcpResource({ name: 'a', uri: 'docs://readme', handler: () => 'a' }),
          defineMcpResource({ name: 'b', uri: 'docs://readme', handler: () => 'b' }),
        ],
      }),
    ).toThrow(/Resources must answer distinct URIs, but "docs:\/\/readme" is used twice/)
  })

  it('rejects a definition with a blank name', () => {
    expect(() =>
      createMcpHandler({ tools: [defineMcpTool({ name: '  ', handler: () => 'ok' })] }),
    ).toThrow(/A tool was defined without a name/)
  })

  it('reports every problem at once', () => {
    const build = () =>
      createMcpHandler({
        tools: [
          defineMcpTool({ name: 'greet', inputSchema: z.object({}), handler: () => 'a' }),
          defineMcpTool({ name: 'greet', handler: () => 'b' }),
          defineMcpTool({ name: '', handler: () => 'c' }),
        ],
      })

    expect(build).toThrow(/without a name/)
    expect(build).toThrow(/used twice/)
  })

  it('accepts an empty server', () => {
    expect(() => createMcpHandler()).not.toThrow()
  })

  // Two files sharing a name is the mistake discovery makes easy to commit, so
  // the message has to say which files to go and look at.
  it('names the files behind a clash between discovered definitions', () => {
    const greet = defineMcpTool({ name: 'greet', handler: () => 'ok' })

    expect(() =>
      createMcpHandler({
        tools: [
          { ...greet, source: { file: 'tools/greet.ts' } },
          { ...greet, source: { file: 'tools/admin/greet.ts' } },
        ],
      }),
    ).toThrow(/"greet" is used twice \(tools\/greet\.ts, tools\/admin\/greet\.ts\)/)
  })

  it('says where a nameless definition came from', () => {
    const nameless = defineMcpTool({ handler: () => 'ok' })

    expect(() =>
      createMcpHandler({ tools: [{ ...nameless, source: { file: 'tools/index.ts' } }] }),
    ).toThrow(/A tool was defined without a name \(tools\/index\.ts\)/)
  })
})
