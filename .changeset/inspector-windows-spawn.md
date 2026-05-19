---
"@nuxtjs/mcp-toolkit": patch
---

Fix "spawn npx ENOENT" error when launching the MCP Inspector on Windows.

Since the Node.js CVE-2024-27980 mitigation (Node 18.20.2 / 20.12.2), `child_process.spawn` no longer resolves `.cmd`/`.bat` shims on Windows without `shell: true`. This caused the DevTools "Launch Inspector" button to throw `ENOENT` on every Windows machine.

`shell: true` is now passed only when `process.platform === 'win32'`, leaving the default behaviour unchanged on Linux and macOS.

Closes #259.
