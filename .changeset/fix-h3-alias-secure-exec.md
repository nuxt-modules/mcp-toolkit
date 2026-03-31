---
'@nuxtjs/mcp-toolkit': patch
---

Fix h3 v2 poisoning Nitro bundle and suppress secure-exec warning

- Add Nitro alias to resolve h3 from nitropack's own dependency chain, preventing h3 v2 (from peer dep) from overriding h3 v1 in the entire Nitro bundle
- Add `secure-exec` to `rollupConfig.external` in addition to `externals.external` to suppress the Rollup warning in dev mode
