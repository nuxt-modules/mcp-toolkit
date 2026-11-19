---
"@nuxtjs/mcp-toolkit": patch
---

The module only aliases `h3` to the copy `nitropack` uses when Nuxt builds the server with Nitro v2. On Nuxt 5 (Nitro v3) with `nitropack` still installed, the alias made the build fail on `h3/rules`, or, with `nitroLegacy.h3`, made Nuxt remove it and warn with `NUXT_B9015`.
