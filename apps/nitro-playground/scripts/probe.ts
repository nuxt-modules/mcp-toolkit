import { createMcpTestClient } from 'nitro-mcp-toolkit/testing'
import type { Client } from '@modelcontextprotocol/client'

// Port 3030 keeps the playground clear of the Nuxt playground and the docs app.
const url = process.env.MCP_URL ?? 'http://localhost:3030/mcp'

const usage = `Usage
  probe                            list every definition, on both protocol eras
  probe <tool> [json]              call a tool
  probe --resource <uri>           read a resource
  probe --prompt <name> [json]     render a prompt`

/**
 * `createMcpTestClient` only needs something fetch-shaped, so the same helper
 * the unit tests drive in memory also works against a live dev server.
 */
const connect = (era: 'modern' | 'legacy' = 'modern'): Promise<Client> =>
  createMcpTestClient({ fetch: (request) => globalThis.fetch(request) }, { era, url })

async function withClient(run: (client: Client) => Promise<void>, era?: 'modern' | 'legacy') {
  const client = await connect(era)
  try {
    await run(client)
  } finally {
    await client.close()
  }
}

/** The `_meta` envelope repeats on every result, so it is dropped from view. */
function show(result: Record<string, unknown>): void {
  const { _meta, content, structuredContent, contents, messages, isError, ...rest } = result

  if (isError) {
    console.log('isError: true')
  }

  for (const block of (content ?? []) as Array<Record<string, string>>) {
    if (block.type === 'text') {
      console.log(block.text)
    } else {
      console.log(`[${block.type} ${block.mimeType}, ${block.data?.length ?? 0} base64 chars]`)
    }
  }

  for (const entry of (contents ?? []) as Array<Record<string, string>>) {
    console.log(`${entry.uri}\n${entry.text ?? `[${entry.blob?.length ?? 0} base64 chars]`}`)
  }

  for (const message of (messages ?? []) as Array<{ role: string; content: { text?: string } }>) {
    console.log(`${message.role}: ${message.content.text ?? ''}`)
  }

  if (structuredContent) {
    console.log(`structuredContent: ${JSON.stringify(structuredContent)}`)
  }

  if (Object.keys(rest).length > 0) {
    console.log(`extra: ${JSON.stringify(rest)}`)
  }
}

async function list(era: 'modern' | 'legacy'): Promise<void> {
  await withClient(async (client) => {
    const [tools, resources, templates, prompts] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listResourceTemplates(),
      client.listPrompts(),
    ])

    const server = client.getServerVersion()
    console.log(`\n── ${era} ── ${server?.name ?? '?'}@${server?.version ?? '?'}`)
    console.table([
      ...tools.tools.map((t) => ({ kind: 'tool', name: t.name, detail: t.description ?? '' })),
      ...resources.resources.map((r) => ({ kind: 'resource', name: r.name, detail: r.uri })),
      ...templates.resourceTemplates.map((t) => ({
        kind: 'template',
        name: t.name,
        detail: t.uriTemplate,
      })),
      ...prompts.prompts.map((p) => ({
        kind: 'prompt',
        name: p.name,
        detail: p.description ?? '',
      })),
    ])
  }, era)
}

const args = process.argv.slice(2)
const parse = (raw: string | undefined) => (raw ? JSON.parse(raw) : {})

try {
  if (args[0] === '--help') {
    console.log(usage)
  } else if (args[0] === '--resource') {
    if (!args[1]) throw new Error(`Missing URI.\n${usage}`)
    await withClient(async (client) => show(await client.readResource({ uri: args[1]! })))
  } else if (args[0] === '--prompt') {
    if (!args[1]) throw new Error(`Missing prompt name.\n${usage}`)
    await withClient(async (client) =>
      show(await client.getPrompt({ name: args[1]!, arguments: parse(args[2]) })),
    )
  } else if (args[0]) {
    await withClient(async (client) =>
      show(await client.callTool({ name: args[0]!, arguments: parse(args[1]) })),
    )
  } else {
    await list('modern')
    await list('legacy')
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nProbe failed against ${url}\n${message}`)
  if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
    console.error('\nIs the playground running? `pnpm dev:nitro` from the monorepo root.')
  }
  process.exitCode = 1
}
