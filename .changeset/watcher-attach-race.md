---
"nitro-mcp-toolkit": patch
---

Development servers no longer miss a definitions directory created after startup. The watcher now attaches before it checks the directory, so a folder or file that appears in between still triggers a rebuild.
