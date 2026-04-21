---
"@nuxtjs/mcp-toolkit": patch
---

Internal refactor: tighten TypeScript across the module and split `module.ts` into focused setup helpers (`evlog`, `nitro-aliases`, `definitions`, `auto-imports`). Removes the remaining `as any` casts in `server.ts`, `logger.ts`, `elicitation.ts`, `utils.ts`, `compat.ts`, `executor.ts` and `handler.ts`, centralises virtual-module declarations under `runtime/types/virtual-modules.d.ts`, and adds an ambient type surface for the optional `secure-exec` peer dep. No public API changes.
