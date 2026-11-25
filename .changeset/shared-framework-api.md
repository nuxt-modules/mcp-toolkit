---
"nitro-mcp-toolkit": major
---

Add framework integration APIs for the 1.0 beta. Overlay definition directories with `dir: ['server/mcp', 'layers/base/server/mcp']`, where the first matching relative file wins. Import generated definitions and plugin arrays through `include.tools`, `include.resources`, `include.prompts`, and `include.plugins`.

Tools, resources, templates, and prompts preserve custom `_meta` for client extensions. Framework adapters can pass request context by reference with `handler.fetch(request, context)`. Module options also expose serializable `session`, `logging`, and request `limits`. Errors thrown with H3 v1 or v2, including Nuxt's `createError`, keep their status and `data` in tool results. Other errors, such as failed `$fetch` calls, report only their message, so an upstream response body never reaches the client.
