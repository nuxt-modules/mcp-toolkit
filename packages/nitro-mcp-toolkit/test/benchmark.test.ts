import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { exercise } from '../benchmarks/catalog.bench.ts'

const url = 'http://localhost/mcp'

describe('benchmark workloads', () => {
  it('consumes every catalog page and forwards the cursor', async () => {
    const requests: unknown[] = []
    const results = [
      { tools: [{ name: 'first' }], nextCursor: 'page-two' },
      { tools: [{ name: 'second' }] },
    ]
    const pages = await exercise(
      {
        url,
        fetch: async (request) => {
          requests.push(await request.json())
          return Response.json({ result: results.shift() })
        },
      },
      2,
      'memory',
      'catalog',
    )
    expect(pages).toBe(2)
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({ method: 'tools/list', params: { cursor: 'page-two' } })
  })

  it('sends the selected tool header and validates the returned value', async () => {
    let received: Request | undefined
    const fixture = {
      url,
      fetch: async (request: Request) => {
        received = request
        return Response.json({ result: { content: [{ type: 'text', text: '42' }] } })
      },
    }
    await expect(exercise(fixture, 10, 'memory', 'subset')).resolves.toBe(1)
    expect(received?.headers.get('x-mcp-tools')).toBe('tool-9')
    expect(received?.headers.get('mcp-name')).toBe('tool-9')
    await expect(
      exercise(
        {
          url,
          fetch: async () => Response.json({ result: { content: [{ type: 'text', text: '41' }] } }),
        },
        10,
        'memory',
        'call',
      ),
    ).rejects.toThrow(/42/)
  })

  it('rejects failed requests, error results and incomplete catalogs', async () => {
    await expect(
      exercise({ url, fetch: async () => new Response('', { status: 500 }) }, 10, 'memory', 'call'),
    ).rejects.toThrow(/500/)
    await expect(
      exercise(
        { url, fetch: async () => Response.json({ error: { message: 'failed' } }) },
        10,
        'memory',
        'call',
      ),
    ).rejects.toThrow('failed')
    await expect(
      exercise(
        { url, fetch: async () => Response.json({ result: { isError: true } }) },
        10,
        'memory',
        'call',
      ),
    ).rejects.toThrow('isError')
    await expect(
      exercise(
        { url, fetch: async () => Response.json({ result: { tools: [{ name: 'first' }] } }) },
        3,
        'memory',
        'catalog',
      ),
    ).rejects.toThrow(/1 !== 3/)
  })

  it('rejects repeating pagination cursors instead of timing an infinite loop', async () => {
    await expect(
      exercise(
        {
          url,
          fetch: async () => Response.json({ result: { tools: [], nextCursor: 'page-two' } }),
        },
        10,
        'memory',
        'catalog',
      ),
    ).rejects.toThrow('Repeated cursor: page-two')
  })

  it('makes Vitest fail on an invalid warmup response', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mcp-benchmark-failure-'))
    const entry = join(directory, 'invalid.mjs')
    try {
      await writeFile(
        entry,
        `export const defineMcpTool = tool => tool;
export const createMcpHandler = () => ({ fetch: async () => Response.json({ result: { content: [{ type: 'text', text: 'wrong' }] } }) });`,
      )
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
          'bench',
          '--run',
          '-t',
          '10/memory/call',
        ],
        {
          cwd: fileURLToPath(new URL('..', import.meta.url)),
          encoding: 'utf8',
          timeout: 15_000,
          env: {
            ...process.env,
            MCP_BENCH_ENTRY: pathToFileURL(entry).href,
            MCP_BENCH_TIME: '1',
            NO_COLOR: '1',
            FORCE_COLOR: '0',
          },
        },
      )
      const output = result.stdout + result.stderr
      expect(result.status, output).toBe(1)
      expect(output).toContain('AssertionError')
      expect(output).toContain('wrong')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
