---
"@nuxtjs/mcp-toolkit": patch
---

Accept `agents` from 0.20.1 and `vue` / `@vue/compiler-sfc` from 3.5.41 again. 0.22.0 raised these peer ranges without a code change that needed them, so apps on the older versions got unmet-peer warnings.
