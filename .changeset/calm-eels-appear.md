---
"nitro-mcp-toolkit": major
"@nuxtjs/mcp-toolkit": major
---

Keep file-discovered endpoints when authentication needs runtime configuration. Set `auth` to a server-only file default-exporting `defineMcpAuth()` options; callbacks read private credentials at request time instead of embedding them in generated configuration. Missing files and invalid exports refuse access.

Nitro 2 consumers now tree-shake the toolkit's own MCP engine, H3 v2 and JWT dependencies while preserving the host's H3 v1 runtime. When neither the endpoint nor the application uses OAuth/JWT helpers, deployment output omits `jose`; configured OAuth continues to verify JWT access tokens.

Infer literal and enum output fields in `defineMcpTool()` callbacks without return-type annotations or `satisfies`. Typed output remains validated, including array fields and explicit protocol results.
