---
"@nuxtjs/mcp-toolkit": patch
"nitro-mcp-toolkit": patch
---

Keep continuation helpers compatible with Nuxt's Nitro 2 host types. Input-response helpers and signed request-state codecs now expose canonical H3 v2 event signatures while retaining the shared engine's function references and inferred response types. The test client accepts a request-only fetch handler, including a composed Nuxt handler.
