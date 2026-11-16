---
"@nuxtjs/mcp-toolkit": patch
---

The DevTools tab no longer imports `@nuxt/devtools-kit`, which the module does not declare, so `nuxt dev` starts under strict pnpm installs.
