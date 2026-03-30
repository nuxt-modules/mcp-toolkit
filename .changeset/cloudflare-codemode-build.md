---
"@nuxtjs/mcp-toolkit": patch
---

Fix Cloudflare (Nitro) builds failing when codemode’s Node-only executor pulled in `secure-exec` and `node:http`: lazy-load the executor and alias it to a Workers-safe stub when the preset is cloudflare ([#189](https://github.com/nuxt-modules/mcp-toolkit/issues/189)). `experimental_codeMode` remains unsupported on Workers and returns a clear runtime error if enabled.
