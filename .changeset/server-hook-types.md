---
"@nuxtjs/mcp-toolkit": patch
---

Load the runtime hook types (`mcp:config:resolved`, `mcp:server:created`, `mcp:tool:called`) in server code of apps that install the module. They were added to the server tsconfig `include`, which excludes `node_modules`, so `nitroApp.hooks.hook('mcp:…')` still did not typecheck. They are now referenced from the generated Nitro types instead.
