---
"nitro-mcp-toolkit": major
---

Add Nitro 2 support through `nitro-mcp-toolkit/module/nitro2`, sharing the definition API and engine with Nitro 3. The adapter preserves middleware context, headers, request bodies, notifications, and disconnect cancellation. Requires Nitro 2.13.4+ and Node 20.19+.

H3 v2 is now an internal dependency rather than a peer, so Nitro 2 applications can retain H3 v1. The Nitro 3 module entrypoint remains `nitro-mcp-toolkit/module`.

Move the toolkit's request notifier to `event.context.mcp.notifier` to preserve the engine's callable `notify` function and fix progress/logging. Replace calls such as `event.context.mcp.notify.toolsChanged()` with `event.context.mcp.notifier.toolsChanged()`. `handler.notify` is unchanged.

This is the Nitro transport step of the staged 1.0 migration. Beta publishing follows the reviewed version PR on `v1`.
