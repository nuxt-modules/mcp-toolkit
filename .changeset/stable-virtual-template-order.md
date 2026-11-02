---
"@nuxtjs/mcp-toolkit": patch
---

The module registers its server templates in a fixed order, so the key order of `nuxt.options.nitro.virtual` stays the same between identical builds.
