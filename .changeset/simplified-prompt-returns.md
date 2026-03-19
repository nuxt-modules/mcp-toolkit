---
"@nuxtjs/mcp-toolkit": minor
---

Allow prompt handlers to return a simple `string`, automatically wrapped into `{ messages: [{ role: 'user', content: { type: 'text', text } }] }`. The full `GetPromptResult` return type is still supported.
