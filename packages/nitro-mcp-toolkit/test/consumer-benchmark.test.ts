import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { expect, it } from 'vitest'
import { requestOptions } from '../benchmarks/consumer.ts'

it('refuses a startup measurement when the consumer returns an error or the wrong result', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'consumer-startup-test-'))
  try {
    const entry = join(temporary, 'server.mjs')
    for (const result of [
      { content: [{ type: 'text', text: 'wrong' }] },
      { content: [{ type: 'text', text: '42' }], isError: true },
    ]) {
      await writeFile(
        entry,
        `export default { fetch: async () => Response.json(${JSON.stringify({ result })}) }`,
      )
      const child = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('../benchmarks/consumer-worker.ts', import.meta.url))],
        {
          encoding: 'utf8',
          timeout: 10_000,
          env: {
            ...process.env,
            MCP_CONSUMER_ENTRY: entry,
            MCP_CONSUMER_REQUEST: JSON.stringify(requestOptions(1, false)),
          },
        },
      )
      expect(child.error).toBeUndefined()
      expect(child.status).toBe(1)
      expect(child.stderr).toContain('AssertionError')
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
