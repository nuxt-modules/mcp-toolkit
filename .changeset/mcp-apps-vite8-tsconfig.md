---
"@nuxtjs/mcp-toolkit": patch
---

MCP Apps with `<script setup lang="ts">` bundle again on Vite 8. The isolated app build no longer inherits the host `tsconfig.json` (which extends `.nuxt/tsconfig.json` before Nuxt has written it).
