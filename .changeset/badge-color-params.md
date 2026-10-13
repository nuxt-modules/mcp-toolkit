---
"@nuxtjs/mcp-toolkit": patch
---

The install badge (`/mcp/badge.svg`) now only accepts hex values for `color`, `textColor` and `borderColor`, without the `#`, and uses the default color for anything else. `label` escaping also covers quotes, and the response sends a restrictive `Content-Security-Policy`. Badges rendered as images look the same.
