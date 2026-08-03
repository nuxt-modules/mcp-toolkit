---
"@nuxtjs/mcp-toolkit": patch
---

Send `log.notify.*` on the stream of the request being handled, so a notification emitted from a tool, resource or prompt is no longer lost. It previously went to the client's standalone SSE stream, which the client opens only after `connect()` returns — anything sent before then, including from the first tool call, was dropped. The client's `logging/setLevel` is still honoured.
