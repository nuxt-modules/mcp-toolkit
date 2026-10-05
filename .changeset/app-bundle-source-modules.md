---
"@nuxtjs/mcp-toolkit": patch
---

MCP App bundles now handle modules imported from the project like the app SFC itself. A component with `<script setup lang="ts">` no longer fails `nuxt prepare` and `nuxt build` on a clean checkout with `TSCONFIG_ERROR`. Imported SFCs get the same auto-imports (`ref`, `computed`, `useMcpApp`, …). Nuxt's path aliases into the project, such as `~~` and `#shared`, resolve. Side-effect imports like `import './app.css'` and relative `mcp.apps.css` paths resolve as well, from the SFC's directory and the project root respectively.
