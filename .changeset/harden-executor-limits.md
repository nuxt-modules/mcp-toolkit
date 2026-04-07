---
"@nuxtjs/mcp-toolkit": patch
---

Harden code-mode executor with resource limits (memory, timeout, call-depth), per-execution `AsyncLocalStorage` context, and concurrency safety via a semaphore that caps parallel sandbox runs.
