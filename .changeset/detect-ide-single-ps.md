---
"@nuxtjs/mcp-toolkit": patch
---

IDE detection at dev server start reads the process table with one `ps` call instead of two per parent process, so `nuxt dev` no longer blocks for about 0.4 s when no IDE environment variable is set.
