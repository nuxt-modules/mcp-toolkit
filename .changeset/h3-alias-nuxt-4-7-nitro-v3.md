---
"@nuxtjs/mcp-toolkit": patch
---

The module no longer aliases `h3` to nitropack's copy when Nuxt 4.7 opts into Nitro v3. Nuxt 4.7's `@nuxt/nitro-server` still depends on `nitropack`, so the alias reached Nitro v3 builds, where Nuxt removed it and warned with `NUXT_B9015`, or kept it when `nitroLegacy` was off.
