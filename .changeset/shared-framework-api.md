---
"nitro-mcp-toolkit": major
---

Add framework integration APIs for the 1.0 beta. Overlay definition directories with `dir: ['server/mcp', 'layers/base/server/mcp']`, where the first matching relative file wins. Import generated definitions and plugin arrays through `include.tools`, `include.resources`, `include.prompts`, and `include.plugins`.

Tools, resources, templates, and prompts preserve custom `_meta` for client extensions. Framework adapters can pass request context by reference with `handler.fetch(request, context)`. Module options also expose serializable `session`, `logging`, and request `limits`. HTTP tool errors preserve numeric `status` or `statusCode` and `data` across H3 versions.
