import { defineHandler } from 'h3'
import { definitions } from '../mcp'

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default defineHandler((event) => {
  const endpoint = new URL('/mcp', event.url).href

  const rows = definitions
    .map(
      (definition) =>
        `<tr><td>${definition.kind}</td><td><code>${escape(definition.name)}</code></td>` +
        `<td>${escape(definition.description ?? '')}</td></tr>`,
    )
    .join('')

  event.res.headers.set('content-type', 'text/html; charset=utf-8')

  return `<!doctype html>
<meta charset="utf-8">
<title>Nitro MCP Playground</title>
<style>
  body { font: 15px/1.6 ui-sans-serif, system-ui; margin: 3rem auto; max-width: 46rem; padding: 0 1rem }
  table { border-collapse: collapse; width: 100% }
  td, th { border-bottom: 1px solid #e5e5e5; padding: .4rem .6rem; text-align: left; vertical-align: top }
  pre { background: #f6f6f6; padding: .8rem; overflow-x: auto }
  code { font-size: .9em }
</style>
<h1>Nitro MCP Playground</h1>
<p>MCP endpoint: <code>${escape(endpoint)}</code></p>

<h2>Registered (${definitions.length})</h2>
<table><tr><th>Kind</th><th>Name</th><th>Description</th></tr>${rows}</table>

<h2>Probe it</h2>
<pre>pnpm probe:nitro                       # list everything, both protocol eras
pnpm probe:nitro greet '{"name":"Ada"}' # call one tool</pre>

<h2>Connect an MCP client</h2>
<pre>{
  "mcpServers": {
    "nitro-playground": { "url": "${escape(endpoint)}" }
  }
}</pre>
`
})
