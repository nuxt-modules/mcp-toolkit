---
"nitro-mcp-toolkit": major
"@nuxtjs/mcp-toolkit": major
---

Configure each discovered endpoint from an optional `index.ts` beside its tools, resources and prompts. Default-export `defineMcpServer({ name, instructions, auth })` to keep metadata and runtime authentication out of framework configuration. Module options retain routing, directory selection and OAuth metadata; the index overrides other defaults. The first root containing an index wins across layers. Ambiguous files, invalid exports and conflicting authentication refuse requests. New and removed indexes trigger development rebuilds. Nuxt installation links and `llms.txt` use the discovered public server metadata.
