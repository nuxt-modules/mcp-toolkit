import { defineHandler } from 'h3'

export default defineHandler((event) => {
  event.res.headers.set('content-type', 'text/html; charset=utf-8')

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nitro MCP Playground</title>
<link rel="stylesheet" href="/inspector.css">
<header>
  <h1>Nitro MCP Playground</h1>
  <span class="server"></span>
  <span class="spacer"></span>
  <div class="eras" role="group" aria-label="Protocol revision"></div>
</header>
<form class="connection">
  <label>Endpoint
    <input name="endpoint" value="/mcp" list="endpoints" required spellcheck="false">
    <datalist id="endpoints"><option value="/mcp"><option value="/admin/mcp"></datalist>
  </label>
  <label>Bearer token
    <input name="token" type="password" autocomplete="off" placeholder="Optional; kept in memory">
  </label>
  <button class="run" type="submit">Connect</button>
</form>
<main>
  <nav aria-label="Definitions"></nav>
  <section aria-live="polite"></section>
</main>
<script type="module" src="/inspector.js"></script>
`
})
